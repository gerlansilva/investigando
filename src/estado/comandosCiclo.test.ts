import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configurarFabrica, criarContador, criarProjeto, restaurarFabrica } from '../modelo/fabrica';
import { abrirProjeto, salvarProjeto } from '../modelo/esquema';
import type { Projeto } from '../modelo/tipos';
import * as C from './comandos';
import { ErroComando } from './comandos';
import { criarArmazem } from './store';

beforeEach(() => configurarFabrica({ gerarId: criarContador('c'), agora: () => '2026-01-01T00:00:00.000Z' }));
afterEach(() => restaurarFabrica());

const noArmazem = () => criarArmazem(criarProjeto({ titulo: 'Ciclo' }));

describe('comandos do ciclo', () => {
  it('definirPergunta escreve a pergunta do ciclo atual e desfazer volta', () => {
    const a = noArmazem();
    a.getState().executar(C.definirPergunta('Quem vem a pé?'));
    expect(C.cicloCorrente(a.getState().projeto)!.pergunta).toBe('Quem vem a pé?');
    a.getState().desfazer();
    expect(C.cicloCorrente(a.getState().projeto)!.pergunta).toBe('');
    a.getState().refazer();
    expect(C.cicloCorrente(a.getState().projeto)!.pergunta).toBe('Quem vem a pé?');
  });

  it('digitar várias letras seguidas vira um único passo do histórico', () => {
    const a = noArmazem();
    for (const x of ['Q', 'Qu', 'Qua', 'Qual']) a.getState().executar(C.definirPergunta(x));
    expect(a.getState().historico.desfazer).toHaveLength(1);
    a.getState().desfazer();
    expect(C.cicloCorrente(a.getState().projeto)!.pergunta).toBe('');
  });

  it('mudar de etapa entra no histórico e desfazer volta a etapa', () => {
    const a = noArmazem();
    a.getState().executar(C.mudarEtapa('analise'));
    expect(a.getState().projeto.cicloAtual).toBe('analise');
    a.getState().desfazer();
    expect(a.getState().projeto.cicloAtual).toBe('problema');
  });

  it('marcar e desmarcar etapa concluída (sem repetir)', () => {
    const a = noArmazem();
    a.getState().executar(C.marcarEtapaConcluida('dados'));
    a.getState().executar(C.marcarEtapaConcluida('dados'));
    expect(C.cicloCorrente(a.getState().projeto)!.etapasConcluidas).toEqual(['dados']);
    a.getState().executar(C.desmarcarEtapaConcluida('dados'));
    expect(C.cicloCorrente(a.getState().projeto)!.etapasConcluidas).toEqual([]);
  });

  it('a Conclusão só pode ser concluída com os limites preenchidos', () => {
    const a = noArmazem();
    expect(() => a.getState().executar(C.marcarEtapaConcluida('conclusao'))).toThrow(ErroComando);
    a.getState().executar(C.definirCampoConclusao('limites', '   '));
    expect(() => a.getState().executar(C.marcarEtapaConcluida('conclusao'))).toThrow(/não pode afirmar/);
    a.getState().executar(C.definirCampoConclusao('limites', 'Só vale para a nossa turma.'));
    a.getState().executar(C.marcarEtapaConcluida('conclusao'));
    expect(C.cicloCorrente(a.getState().projeto)!.etapasConcluidas).toContain('conclusao');
    // apagar os limites tira a marca de concluída
    a.getState().executar(C.definirCampoConclusao('limites', ''));
    expect(C.cicloCorrente(a.getState().projeto)!.etapasConcluidas).not.toContain('conclusao');
  });

  it('o roteiro compõe o texto da conclusão', () => {
    const a = noArmazem();
    a.getState().executar(C.definirCampoConclusao('vi', 'a maioria vem a pé.'));
    a.getState().executar(C.definirCampoConclusao('mostra', 'a escola é perto'));
    a.getState().executar(C.definirCampoConclusao('naoSei', 'vale para outras turmas'));
    expect(C.cicloCorrente(a.getState().projeto)!.conclusao!.texto).toBe(
      'Vi que a maioria vem a pé. Isso mostra que a escola é perto. Mas não sei se vale para outras turmas.',
    );
  });

  it('novoCiclo arquiva o ciclo, abre n+1 e mantém coleções e objetos', () => {
    const base = criarProjeto();
    base.colecoes.push({ id: 'k', nome: 'K', atributos: [], casos: [] });
    base.objetos.push({ id: 'o', tipo: 'texto', x: 0, y: 0, l: 10, a: 10, etapa: 'problema', estado: {} });
    base.cicloAtual = 'conclusao';
    const a = criarArmazem(base);
    a.getState().executar(C.definirPergunta('Primeira?'));
    a.getState().executar(C.novoCiclo('Segunda?'));
    const p = a.getState().projeto;
    expect(p.ciclos.map((c) => [c.n, c.pergunta, c.arquivado ?? false])).toEqual([[1, 'Primeira?', true], [2, 'Segunda?', false]]);
    expect(C.cicloCorrente(p)!.etapasConcluidas).toEqual([]);
    expect(p.cicloAtual).toBe('problema');
    expect(p.colecoes).toHaveLength(1);
    expect(p.objetos).toHaveLength(1);
    a.getState().desfazer();
    expect(a.getState().projeto.ciclos).toHaveLength(1);
    expect(a.getState().projeto.ciclos[0]!.arquivado).toBeUndefined();
    expect(a.getState().projeto.cicloAtual).toBe('conclusao');
  });

  it('novoCiclo sem pergunta abre o ciclo com a pergunta vazia', () => {
    const a = noArmazem();
    a.getState().executar(C.novoCiclo());
    expect(C.cicloCorrente(a.getState().projeto)).toMatchObject({ n: 2, pergunta: '' });
  });
});

describe('ciclo no arquivo', () => {
  it('ida e volta guarda conclusão e ciclo arquivado', () => {
    const a = noArmazem();
    a.getState().executar(C.definirPergunta('Qual meio é o mais usado?'));
    a.getState().executar(C.definirCampoConclusao('vi', 'o ônibus aparece mais'));
    a.getState().executar(C.definirCampoConclusao('limites', 'Só vale para esta turma.'));
    a.getState().executar(C.novoCiclo('Outra?'));
    const volta = abrirProjeto(salvarProjeto(a.getState().projeto));
    expect(volta.ciclos).toEqual(a.getState().projeto.ciclos);
    expect(volta.ciclos[0]!.conclusao).toMatchObject({ limites: 'Só vale para esta turma.', vi: 'o ônibus aparece mais' });
    expect(volta.ciclos[0]!.arquivado).toBe(true);
  });

  it('abre arquivo antigo sem os campos novos e dá para continuar usando', () => {
    const antigo: Projeto = JSON.parse(salvarProjeto(criarProjeto({ titulo: 'Antigo' })));
    expect(antigo.ciclos[0]).toEqual({ n: 1, pergunta: '', etapasConcluidas: [] }); // sem conclusao nem arquivado
    const aberto = abrirProjeto(JSON.stringify(antigo));
    expect(aberto.ciclos[0]!.conclusao).toBeUndefined();
    const a = criarArmazem(aberto);
    a.getState().executar(C.definirCampoConclusao('limites', 'x'));
    a.getState().executar(C.marcarEtapaConcluida('conclusao'));
    expect(C.cicloCorrente(a.getState().projeto)!.conclusao!.limites).toBe('x');
  });

  it('rejeita conclusão mal formada (texto não é string)', () => {
    const p = JSON.parse(salvarProjeto(criarProjeto()));
    p.ciclos[0].conclusao = { texto: 3, limites: '' };
    expect(() => abrirProjeto(JSON.stringify(p))).toThrow();
  });
});
