import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configurarFabrica, criarAtributo, criarCaso, criarColecao, criarContador, criarObjeto, criarProjeto, restaurarFabrica } from '../../modelo/fabrica';
import { validarProjeto } from '../../modelo/esquema';
import type { Atributo, Caso, Projeto } from '../../modelo/tipos';
import type { RegistroEstatistica } from '../../simulador/historico';
import {
  adicionarCasosEmLote, adicionarColecao, ErroComando, limparCasos, recomecarSimulador, registrarHistoricoEstatistica, registrarLoteSimulador,
  type Comando, type LoteColecao,
} from './index';
import { criarArmazem } from '../store';

beforeEach(() => configurarFabrica({ gerarId: criarContador('c'), agora: () => '2026-01-01T00:00:00.000Z' }));
afterEach(() => restaurarFabrica());

function base(): Projeto {
  const p = criarProjeto({ titulo: 'T' });
  const a = criarAtributo({ nome: 'Valor' });
  const dobro = criarAtributo({ nome: 'Dobro', formula: 'Valor * 2' });
  p.colecoes.push(criarColecao('Dados', [a, dobro], [criarCaso({ [a.id]: 1, [dobro.id]: 2 })]));
  p.objetos.push({ ...criarObjeto('simulador'), id: 'sim' });
  return p;
}

/** Aplica, confere o resultado com `conferir`, reverte e exige projeto idêntico ao inicial. */
function ciclo(p: Projeto, c: Comando, conferir: (depois: Projeto) => void): Projeto {
  const antes = structuredClone(p);
  const trabalho = structuredClone(p);
  c.aplicar(trabalho);
  conferir(trabalho);
  const depoisAplicar = structuredClone(trabalho);
  c.reverter(trabalho);
  expect(trabalho).toEqual(antes);
  c.aplicar(trabalho);
  expect(trabalho).toEqual(depoisAplicar);
  c.reverter(trabalho);
  expect(trabalho).toEqual(antes);
  return depoisAplicar;
}

function casos(n: number, atributoId: string, ini = 0): Caso[] {
  return Array.from({ length: n }, (_, i) => ({ id: `k${ini + i}`, valores: { [atributoId]: ini + i } }));
}

describe('adicionarColecao', () => {
  it('aplicar/reverter idênticos e erros', () => {
    const p = base();
    const nova = criarColecao('Nova', [criarAtributo({ nome: 'X' })]);
    ciclo(p, adicionarColecao(nova), (d) => expect(d.colecoes.map((c) => c.nome)).toEqual(['Dados', 'Nova']));
    ciclo(p, adicionarColecao(nova, 0), (d) => expect(d.colecoes[0]!.nome).toBe('Nova'));
    expect(() => adicionarColecao(p.colecoes[0]!).aplicar(structuredClone(p))).toThrow(ErroComando);
    const dupla = criarColecao('D', [{ ...nova.atributos[0]! }, { ...nova.atributos[0]! }]);
    expect(() => adicionarColecao(dupla).aplicar(structuredClone(p))).toThrow(/dois atributos com o mesmo identificador/);
  });
});

describe('adicionarCasosEmLote', () => {
  it('1.000 casos: um comando, aplicar e reverter idênticos, fórmulas recalculadas', () => {
    const p = base();
    const col = p.colecoes[0]!;
    const [valor, dobro] = col.atributos as [Atributo, Atributo];
    const depois = ciclo(p, adicionarCasosEmLote(col.id, casos(1000, valor.id)), (d) => {
      const c = d.colecoes[0]!;
      expect(c.casos).toHaveLength(1001);
      expect(c.casos[1000]!.valores[valor.id]).toBe(999);
      expect(c.casos[1000]!.valores[dobro.id]).toBe(1998);
    });
    expect(() => validarProjeto(depois)).not.toThrow();
  });

  it('desfaz tudo num só passo pelo histórico', () => {
    const p = base();
    const armazem = criarArmazem(p);
    armazem.getState().executar(adicionarCasosEmLote(p.colecoes[0]!.id, casos(1000, p.colecoes[0]!.atributos[0]!.id)));
    expect(armazem.getState().projeto.colecoes[0]!.casos).toHaveLength(1001);
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
    armazem.getState().desfazer();
    expect(armazem.getState().projeto).toEqual(p);
    armazem.getState().refazer();
    expect(armazem.getState().projeto.colecoes[0]!.casos).toHaveLength(1001);
  });

  it('preenche atributos que faltam com nulo', () => {
    const p = base();
    const col = p.colecoes[0]!;
    ciclo(p, adicionarCasosEmLote(col.id, [{ id: 'novo', valores: {} }]), (d) => {
      expect(d.colecoes[0]!.casos[1]!.valores).toEqual({ [col.atributos[0]!.id]: null, [col.atributos[1]!.id]: null });
    });
  });

  it('erros: coleção inexistente, id repetido, atributo desconhecido', () => {
    const p = base();
    const col = p.colecoes[0]!;
    expect(() => adicionarCasosEmLote('x', []).aplicar(structuredClone(p))).toThrow('Não achei essa coleção no projeto.');
    expect(() => adicionarCasosEmLote(col.id, [col.casos[0]!]).aplicar(structuredClone(p))).toThrow(/Já existe um caso/);
    expect(() => adicionarCasosEmLote(col.id, [{ id: 'a', valores: {} }, { id: 'a', valores: {} }]).aplicar(structuredClone(p))).toThrow(/Já existe um caso/);
    expect(() => adicionarCasosEmLote(col.id, [{ id: 'a', valores: { zzz: 1 } }]).aplicar(structuredClone(p))).toThrow(/atributo que não existe/);
  });
});

describe('limparCasos', () => {
  it('apaga todos os casos e desfaz', () => {
    const p = base();
    const col = p.colecoes[0]!;
    const grande = ciclo(p, adicionarCasosEmLote(col.id, casos(1000, col.atributos[0]!.id)), (d) => expect(d.colecoes[0]!.casos).toHaveLength(1001));
    ciclo(grande, limparCasos(col.id), (d) => {
      expect(d.colecoes[0]!.casos).toEqual([]);
      expect(d.colecoes[0]!.atributos).toHaveLength(2);
    });
    expect(() => limparCasos('x').aplicar(structuredClone(p))).toThrow(ErroComando);
  });
});

describe('registrarHistoricoEstatistica', () => {
  const registro: RegistroEstatistica = {
    id: 'h1', objetoId: 'sim', criadoEm: '2026-01-01T00:00:00.000Z', rotulo: 'Caras', formula: 'contagem()', dispositivo: 'roleta',
    itensPorRepeticao: 10, repeticoes: 100, semente: 3, colecaoId: 'c1', resumo: { n: 100, media: 5, minimo: 1, maximo: 9 },
  };

  it('guarda o registro validado, e reverte', () => {
    const p = base();
    const d = ciclo(p, registrarHistoricoEstatistica(registro), (x) => expect(x.historicoEstatisticas).toEqual([registro]));
    expect(() => validarProjeto(d)).not.toThrow();
  });

  it('registro malformado vira ErroComando em português já na criação', () => {
    expect(() => registrarHistoricoEstatistica({ id: 'x' })).toThrow(ErroComando);
    expect(() => registrarHistoricoEstatistica({ id: 'x' })).toThrow(/O registro da estatística está incompleto/);
  });
});

describe('registrarLoteSimulador', () => {
  const atrs = (): Atributo[] => [
    { id: 'col-repeticao', nome: 'Repetição', tipo: 'numerico', cor: 'c' },
    { id: 'col-resultado', nome: 'Resultado', tipo: 'categorico', cor: 'c' },
  ];
  const lote = (ini: number, n: number): LoteColecao => ({
    id: 'res', nome: 'Resultados do simulador', atributos: atrs(),
    casos: Array.from({ length: n }, (_, i) => ({ id: `r-${ini + i}`, valores: { 'col-repeticao': ini + i, 'col-resultado': 'Cara' } })),
  });

  it('cria a coleção, liga ao objeto, adiciona 1.000 casos; reverte tudo', () => {
    const p = base();
    ciclo(p, registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'e1', resultados: lote(0, 1000), semente: 9, rodada: 1 }), (d) => {
      const c = d.colecoes.find((x) => x.id === 'res')!;
      expect(c.casos).toHaveLength(1000);
      expect(c.atributos.map((a) => a.nome)).toEqual(['Repetição', 'Resultado']);
      expect(d.objetos[0]!.estado).toEqual({ colecaoId: 'res', semente: 9, rodada: 1 });
      expect(() => validarProjeto(d)).not.toThrow();
    });
  });

  it('cria resultados, estatísticas e registro juntos, e reverte', () => {
    const p = base();
    const est: LoteColecao = {
      id: 'est', nome: 'Estatísticas', atributos: [{ id: 'est-valor', nome: 'Caras', tipo: 'numerico', cor: 'c' }],
      casos: [{ id: 'e-1', valores: { 'est-valor': 4 } }],
    };
    const registro: RegistroEstatistica = {
      id: 'h1', objetoId: 'sim', criadoEm: 'x', rotulo: 'Caras', formula: 'contagem()', dispositivo: 'roleta',
      itensPorRepeticao: 1, repeticoes: 1, semente: 1, colecaoId: 'est', resumo: { n: 1, media: 4, minimo: 4, maximo: 4 },
    };
    ciclo(p, registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'e', estatisticas: est, registro }), (d) => {
      expect(d.colecoes.map((c) => c.id)).toEqual([p.colecoes[0]!.id, 'est']);
      expect(d.objetos[0]!.estado).toEqual({ colecaoEstatisticasId: 'est' });
      expect(d.historicoEstatisticas).toEqual([registro]);
    });
  });

  it('preserva o resto do estado do objeto e acrescenta atributos novos a coleção existente', () => {
    let p = base();
    p.objetos[0]!.estado = { dispositivo: 'misturador', colecaoId: 'res' };
    p = ciclo(p, registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'a', resultados: lote(0, 2) }), (d) => expect(d.objetos[0]!.estado).toMatchObject({ dispositivo: 'misturador', colecaoId: 'res' }));
    const mais: LoteColecao = { ...lote(2, 1), atributos: [...atrs(), { id: 'col-soma', nome: 'Soma', tipo: 'numerico', cor: 'c' }] };
    mais.casos[0]!.valores['col-soma'] = 7;
    ciclo(p, registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'b', resultados: mais }), (d) => {
      const c = d.colecoes.find((x) => x.id === 'res')!;
      expect(c.casos.map((k) => k.valores['col-soma'])).toEqual([null, null, 7]);
    });
  });

  it('é idempotente por id de caso e atualiza o registro com o mesmo id (refazer com mais casos não duplica)', () => {
    const p = base();
    const cmd1 = registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'a', resultados: lote(0, 3) });
    const intermediario = structuredClone(p);
    cmd1.aplicar(intermediario);
    registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'a', resultados: lote(0, 5) }).aplicar(intermediario);
    expect(intermediario.colecoes.find((c) => c.id === 'res')!.casos).toHaveLength(5);
  });

  it('chunks da mesma execução fundem num único passo do desfazer; desfazer volta ao projeto original', () => {
    const p = base();
    const armazem = criarArmazem(p);
    const s = () => armazem.getState();
    for (const n of [100, 400, 1000]) s().executar(registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'run1', resultados: lote(0, n), rodada: 1 }));
    s().selarHistorico();
    expect(s().projeto.colecoes.find((c) => c.id === 'res')!.casos).toHaveLength(1000);
    expect(s().historico.desfazer).toHaveLength(1);
    s().desfazer();
    expect(s().projeto).toEqual(p);
    s().refazer();
    expect(s().projeto.colecoes.find((c) => c.id === 'res')!.casos).toHaveLength(1000);
    // outra execução depois da primeira selada não funde
    s().executar(registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'run2', resultados: lote(1000, 10) }));
    expect(s().historico.desfazer).toHaveLength(2);
    s().desfazer();
    expect(s().projeto.colecoes.find((c) => c.id === 'res')!.casos).toHaveLength(1000);
  });

  it('erros: objeto inexistente e atributo com nome repetido', () => {
    const p = base();
    expect(() => registrarLoteSimulador({ objetoId: 'nada', execucaoId: 'a', resultados: lote(0, 1) }).aplicar(structuredClone(p))).toThrow('Não achei esse objeto na mesa.');
    const conflito: LoteColecao = { id: p.colecoes[0]!.id, nome: 'Dados', atributos: [{ id: 'outro', nome: 'valor', tipo: 'numerico', cor: 'c' }], casos: [] };
    expect(() => registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'a', resultados: conflito }).aplicar(structuredClone(p))).toThrow(/Já existe um atributo chamado 'valor'/);
  });

  it('registro inválido falha na criação', () => {
    expect(() => registrarLoteSimulador({ objetoId: 'sim', execucaoId: 'a', registro: { id: 'x' } as unknown as RegistroEstatistica })).toThrow(ErroComando);
  });
});

describe('recomecarSimulador', () => {
  it('apaga os casos das coleções do simulador, zera a rodada, e reverte idêntico', () => {
    const p = base();
    const cmd = registrarLoteSimulador({
      objetoId: 'sim', execucaoId: 'a', rodada: 3,
      resultados: { id: 'res', nome: 'R', atributos: [{ id: 'a', nome: 'A', tipo: 'numerico', cor: 'c' }], casos: casos(50, 'a') },
      estatisticas: { id: 'est', nome: 'E', atributos: [{ id: 'b', nome: 'B', tipo: 'numerico', cor: 'c' }], casos: casos(20, 'b') },
    });
    cmd.aplicar(p);
    ciclo(p, recomecarSimulador('sim'), (d) => {
      expect(d.colecoes.find((c) => c.id === 'res')!.casos).toEqual([]);
      expect(d.colecoes.find((c) => c.id === 'est')!.casos).toEqual([]);
      expect(d.colecoes[0]!.casos).toHaveLength(1);
      expect(d.objetos[0]!.estado).toMatchObject({ colecaoId: 'res', rodada: 0 });
    });
  });

  it('funciona mesmo sem coleções criadas ainda', () => {
    ciclo(base(), recomecarSimulador('sim'), (d) => expect(d.objetos[0]!.estado).toEqual({ rodada: 0 }));
  });
});
