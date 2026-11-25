import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configurarFabrica, criarAtributo, criarCaso, criarColecao, criarContador, criarObjeto as novoObjeto, criarProjeto, restaurarFabrica } from '../modelo/fabrica';
import { TIPOS_OBJETO, ETAPAS, type Projeto } from '../modelo/tipos';
import { salvarProjeto } from '../modelo/esquema';
import * as C from './comandos';
import { ErroComando, type Comando } from './comandos';
import * as H from './historico';
import { criarArmazem } from './store';

let gerar: () => string;

beforeEach(() => {
  gerar = criarContador('e');
  configurarFabrica({ gerarId: gerar, agora: () => '2026-01-01T00:00:00.000Z' });
});
afterEach(() => restaurarFabrica());

function projetoBase(): Projeto {
  const p = criarProjeto({ titulo: 'Teste' });
  const idade = criarAtributo({ nome: 'Idade' });
  const nome = criarAtributo({ nome: 'Nome', tipo: 'texto' });
  const dobro = criarAtributo({ nome: 'Dobro', formula: 'Idade * 2' });
  p.colecoes.push(
    criarColecao('Alunos', [idade, nome, dobro], [
      criarCaso({ [idade.id]: 10, [nome.id]: 'Ana', [dobro.id]: 20 }),
      criarCaso({ [idade.id]: 12, [nome.id]: 'Bia', [dobro.id]: 24 }),
      criarCaso({ [idade.id]: 11, [nome.id]: 'Caio', [dobro.id]: 22 }),
    ]),
  );
  p.objetos.push(novoObjeto('tabela'), novoObjeto('grafico'));
  return p;
}

function aplicarDireto(p: Projeto, c: Comando): Projeto {
  const copia = structuredClone(p);
  c.aplicar(copia);
  return copia;
}

describe('comandos individuais', () => {
  it('cada comando: aplicar e reverter devolve o projeto idêntico', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    const [idade, nome] = col.atributos;
    const cmds: Comando[] = [
      C.criarObjeto(novoObjeto('texto', { estado: { t: 'oi' } })),
      C.moverObjeto(p.objetos[0]!.id, 100, 200),
      C.redimensionarObjeto(p.objetos[0]!.id, { l: 10, a: 20, x: 1 }),
      C.apagarObjeto(p.objetos[1]!.id),
      C.mudarEstadoObjeto(p.objetos[0]!.id, { a: [1, 2, { b: null }] }),
      C.mudarEtapa('analise'),
      C.editarCelula(col.id, col.casos[0]!.id, idade!.id, 99),
      C.adicionarCaso(col.id, criarCaso({ [idade!.id]: 7 }), 1),
      C.apagarCasos(col.id, [col.casos[0]!.id, col.casos[2]!.id]),
      C.adicionarAtributo(col.id, criarAtributo({ nome: 'Triplo', formula: 'Idade * 3' }), 0),
      C.renomearAtributo(col.id, idade!.id, 'Anos'),
      C.apagarAtributo(col.id, nome!.id),
      C.apagarAtributo(col.id, idade!.id),
      C.definirFormula(col.id, nome!.id, 'Idade + 1'),
      C.definirGlobal('k', 3),
      C.ocultarCasos(col.id, [col.casos[1]!.id]),
      C.mostrarOcultos(col.id),
    ];
    for (const c of cmds) {
      const copia = structuredClone(p);
      c.aplicar(copia);
      if (c.rotulo !== 'Mostrar casos ocultos') expect(copia).not.toStrictEqual(p);
      c.reverter(copia);
      expect(copia).toStrictEqual(p);
    }
  });

  it('editar célula recalcula atributos calculados', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    const depois = aplicarDireto(p, C.editarCelula(col.id, col.casos[0]!.id, col.atributos[0]!.id, 50));
    expect(depois.colecoes[0]!.casos[0]!.valores[col.atributos[2]!.id]).toBe(100);
  });

  it('adicionar caso preenche atributos ausentes com nulo e calcula', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    const depois = aplicarDireto(p, C.adicionarCaso(col.id, criarCaso({ [col.atributos[0]!.id]: 5 })));
    const novo = depois.colecoes[0]!.casos[3]!;
    expect(novo.valores).toEqual({ [col.atributos[0]!.id]: 5, [col.atributos[1]!.id]: null, [col.atributos[2]!.id]: 10 });
  });

  it('renomear atributo reescreve fórmulas que o usam', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    const depois = aplicarDireto(p, C.renomearAtributo(col.id, col.atributos[0]!.id, 'Anos de vida'));
    expect(depois.colecoes[0]!.atributos[2]!.formula).toBe('[Anos de vida] * 2');
    expect(depois.colecoes[0]!.casos[0]!.valores[col.atributos[2]!.id]).toBe(20);
  });

  it('apagar atributo remove o valor de todos os casos', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    const depois = aplicarDireto(p, C.apagarAtributo(col.id, col.atributos[1]!.id));
    expect(depois.colecoes[0]!.casos.every((c) => !(col.atributos[1]!.id in c.valores))).toBe(true);
  });

  it('ocultar e mostrar casos', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    const oculto = aplicarDireto(p, C.ocultarCasos(col.id, [col.casos[1]!.id]));
    expect(oculto.colecoes[0]!.casos.map((c) => c.oculto)).toEqual([undefined, true, undefined]);
    const visivel = aplicarDireto(oculto, C.mostrarOcultos(col.id));
    expect(visivel.colecoes[0]!.casos.every((c) => c.oculto === undefined && !('oculto' in c))).toBe(true);
  });

  it('erros em português quando o alvo não existe ou o nome repete', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    expect(() => aplicarDireto(p, C.moverObjeto('nada', 1, 1))).toThrow('Não achei esse objeto na mesa.');
    expect(() => aplicarDireto(p, C.editarCelula('nada', 'x', 'y', 1))).toThrow(ErroComando);
    expect(() => aplicarDireto(p, C.adicionarAtributo(col.id, criarAtributo({ nome: 'idade' })))).toThrow("Já existe um atributo chamado 'idade'.");
    expect(() => aplicarDireto(p, C.renomearAtributo(col.id, col.atributos[0]!.id, ''))).toThrow('O nome do atributo não pode ficar vazio.');
  });

  it('rótulos em português', () => {
    const p = projetoBase();
    const col = p.colecoes[0]!;
    expect(C.criarObjeto(novoObjeto('grafico')).rotulo).toBe('Criar gráfico');
    expect(C.apagarCasos(col.id, ['a', 'b']).rotulo).toBe('Apagar 2 casos');
    expect(C.apagarCasos(col.id, ['a']).rotulo).toBe('Apagar caso');
    expect(C.mudarEtapa('conclusao').rotulo).toBe('Mudar para a etapa Conclusão');
    expect(C.adicionarAtributo(col.id, criarAtributo({ nome: 'Peso' })).rotulo).toBe("Adicionar atributo 'Peso'");
  });
});

describe('histórico', () => {
  it('desfazer e refazer; comando novo limpa refazer', () => {
    let p = projetoBase();
    let h = H.criarHistorico();
    const id = p.objetos[0]!.id;
    ({ projeto: p, historico: h } = H.executar(h, p, C.mudarEtapa('dados')));
    ({ projeto: p, historico: h } = H.executar(h, p, C.apagarObjeto(id)));
    expect(p.objetos).toHaveLength(1);
    expect(H.rotuloDesfazer(h)).toBe('Desfazer: Apagar objeto');

    const r1 = H.desfazer(h, p)!;
    expect(r1.projeto.objetos).toHaveLength(2);
    expect(H.rotuloRefazer(r1.historico)).toBe('Refazer: Apagar objeto');

    const r2 = H.executar(r1.historico, r1.projeto, C.mudarEtapa('analise'));
    expect(r2.historico.refazer).toHaveLength(0);
    expect(H.refazer(r2.historico, r2.projeto)).toBeNull();
    expect(H.desfazer(H.criarHistorico(), p)).toBeNull();
  });

  it('funde comandos contínuos até selar o histórico', () => {
    let p = projetoBase();
    const original = p;
    let h = H.criarHistorico();
    const id = p.objetos[0]!.id;
    for (let i = 1; i <= 5; i++) ({ projeto: p, historico: h } = H.executar(h, p, C.moverObjeto(id, i * 10, i * 5)));
    expect(h.desfazer).toHaveLength(1);
    expect(p.objetos[0]).toMatchObject({ x: 50, y: 25 });

    h = H.selar(h);
    ({ projeto: p, historico: h } = H.executar(h, p, C.moverObjeto(id, 500, 500)));
    expect(h.desfazer).toHaveLength(2);

    const r = H.desfazer(h, p)!;
    expect(r.projeto.objetos[0]).toMatchObject({ x: 50, y: 25 });
    const r2 = H.desfazer(r.historico, r.projeto)!;
    expect(r2.projeto).toStrictEqual(original);
    const refeito = H.refazer(r2.historico, r2.projeto)!;
    expect(refeito.projeto.objetos[0]).toMatchObject({ x: 50, y: 25 });
  });

  it('não funde comandos de alvos diferentes', () => {
    let p = projetoBase();
    let h = H.criarHistorico();
    ({ projeto: p, historico: h } = H.executar(h, p, C.moverObjeto(p.objetos[0]!.id, 1, 1)));
    ({ projeto: p, historico: h } = H.executar(h, p, C.moverObjeto(p.objetos[1]!.id, 2, 2)));
    expect(h.desfazer).toHaveLength(2);
  });

  it('funde edições seguidas da mesma célula e recalcula ao refazer', () => {
    let p = projetoBase();
    const col = p.colecoes[0]!;
    let h = H.criarHistorico();
    for (const v of [1, 2, 3]) ({ projeto: p, historico: h } = H.executar(h, p, C.editarCelula(col.id, col.casos[0]!.id, col.atributos[0]!.id, v)));
    expect(h.desfazer).toHaveLength(1);
    expect(p.colecoes[0]!.casos[0]!.valores[col.atributos[2]!.id]).toBe(6);
    const d = H.desfazer(h, p)!;
    expect(d.projeto.colecoes[0]!.casos[0]!.valores[col.atributos[2]!.id]).toBe(20);
    expect(H.refazer(d.historico, d.projeto)!.projeto).toStrictEqual(p);
  });

  it('limita o tamanho da pilha', () => {
    let p = projetoBase();
    let h = H.criarHistorico();
    for (let i = 0; i < H.LIMITE_HISTORICO + 10; i++) {
      ({ projeto: p, historico: h } = H.executar(h, p, C.mudarEtapa(ETAPAS[i % 5]!)));
    }
    expect(h.desfazer).toHaveLength(H.LIMITE_HISTORICO);
  });
});

describe('store', () => {
  it('seleção e foco não entram no histórico nem no arquivo salvo', () => {
    const p = projetoBase();
    const loja = criarArmazem(p);
    const col = p.colecoes[0]!;
    loja.getState().selecionarCasos(col.id, [col.casos[0]!.id, col.casos[1]!.id]);
    loja.getState().focarObjeto(p.objetos[0]!.id);
    const s = loja.getState();
    expect(s.historico.desfazer).toHaveLength(0);
    expect(s.projeto).toBe(p);
    expect([...s.selecaoCasos[col.id]!]).toEqual([col.casos[0]!.id, col.casos[1]!.id]);
    expect(s.serializar()).toBe(salvarProjeto(p));
    expect(s.serializar()).not.toMatch(/selecao|objetoFocado/);
  });

  it('modos de seleção', () => {
    const loja = criarArmazem(projetoBase());
    const col = loja.getState().projeto.colecoes[0]!;
    const [a, b, c] = col.casos.map((x) => x.id) as [string, string, string];
    const sel = () => [...(loja.getState().selecaoCasos[col.id] ?? [])];
    loja.getState().selecionarCasos(col.id, [a]);
    loja.getState().selecionarCasos(col.id, [b], 'somar');
    expect(sel()).toEqual([a, b]);
    loja.getState().selecionarCasos(col.id, [a, c], 'alternar');
    expect(sel()).toEqual([b, c]);
    loja.getState().limparSelecao(col.id);
    expect(sel()).toEqual([]);
  });

  it('apagar casos limpa a seleção; desfazer não a restaura nem a coloca no histórico', () => {
    const loja = criarArmazem(projetoBase());
    const col = loja.getState().projeto.colecoes[0]!;
    const [a, b] = col.casos.map((x) => x.id) as [string, string];
    loja.getState().selecionarCasos(col.id, [a, b]);
    loja.getState().executar(C.apagarCasos(col.id, [a]));
    expect([...loja.getState().selecaoCasos[col.id]!]).toEqual([b]);
    loja.getState().desfazer();
    expect(loja.getState().projeto.colecoes[0]!.casos).toHaveLength(3);
    expect([...loja.getState().selecaoCasos[col.id]!]).toEqual([b]);
  });

  it('apagar objeto focado tira o foco; abrir novo projeto zera efêmeros', () => {
    const p = projetoBase();
    const loja = criarArmazem(p);
    loja.getState().focarObjeto(p.objetos[0]!.id);
    loja.getState().executar(C.apagarObjeto(p.objetos[0]!.id));
    expect(loja.getState().objetoFocado).toBeNull();
    loja.getState().abrir(projetoBase());
    expect(loja.getState().historico.desfazer).toHaveLength(0);
  });

  it('comando inválido não altera o estado', () => {
    const loja = criarArmazem(projetoBase());
    const antes = loja.getState();
    expect(() => loja.getState().executar(C.moverObjeto('nada', 0, 0))).toThrow(ErroComando);
    expect(loja.getState().projeto).toBe(antes.projeto);
    expect(loja.getState().historico).toBe(antes.historico);
  });
});

const acao = fc.record({
  k: fc.integer({ min: 0, max: 16 }),
  a: fc.integer({ min: 0, max: 50 }),
  b: fc.integer({ min: 0, max: 50 }),
  selar: fc.boolean(),
});

function escolher<T>(lista: readonly T[], n: number): T | undefined {
  return lista.length ? lista[n % lista.length] : undefined;
}

function comandoAleatorio(p: Projeto, { k, a, b }: { k: number; a: number; b: number }): Comando | null | undefined {
  const col = escolher(p.colecoes, 0)!;
  const objeto = escolher(p.objetos, a);
  const caso = escolher(col.casos, a);
  const editaveis = col.atributos.filter((x) => !x.formula);
  const qualquer = escolher(col.atributos, b);
  switch (k) {
    case 0: return C.criarObjeto(novoObjeto(escolher(TIPOS_OBJETO, a)!, { x: b, estado: { n: a } }));
    case 1: return objeto && C.moverObjeto(objeto.id, a * 3, b * 3);
    case 2: return objeto && C.redimensionarObjeto(objeto.id, { l: a + 1, a: b + 1, ...(a % 2 ? { x: b } : {}) });
    case 3: return objeto && C.apagarObjeto(objeto.id);
    case 4: {
      const attr = escolher(editaveis, b);
      return caso && attr && C.editarCelula(col.id, caso.id, attr.id, attr.tipo === 'texto' ? `t${a}` : b % 7 === 0 ? null : a);
    }
    case 5: return C.adicionarCaso(col.id, criarCaso({ [editaveis[0]?.id ?? 'x']: a }), a % (col.casos.length + 1));
    case 6: return C.apagarCasos(col.id, col.casos.filter((_, i) => (i + a) % 2 === 0).map((c) => c.id));
    case 7: return C.adicionarAtributo(col.id, criarAtributo({ nome: `Novo${gerar()}`, ...(b % 2 ? { formula: 'Idade + 1' } : {}) }), a % (col.atributos.length + 1));
    case 8: return qualquer && C.renomearAtributo(col.id, qualquer.id, `Nome${gerar()}`);
    case 9: return qualquer && C.apagarAtributo(col.id, qualquer.id);
    case 10: return C.ocultarCasos(col.id, col.casos.filter((_, i) => (i + b) % 2 === 0).map((c) => c.id));
    case 11: return C.mostrarOcultos(col.id);
    case 12: return objeto && C.mudarEstadoObjeto(objeto.id, { v: a, w: [b] });
    case 13: return C.mudarEtapa(ETAPAS[a % 5]!);
    case 14: return qualquer && C.definirFormula(col.id, qualquer.id, b % 3 === 0 ? undefined : `${qualquer.nome} + ${a}`);
    default: return C.definirGlobal('k', a);
  }
}

describe('propriedades (fast-check)', () => {
  it('aplicar seguido de reverter devolve o projeto idêntico, em sequências aleatórias', () => {
    fc.assert(
      fc.property(fc.array(acao, { maxLength: 40 }), (acoes) => {
        gerar = criarContador('p');
        configurarFabrica({ gerarId: gerar });
        let p = projetoBase();
        for (const x of acoes) {
          const cmd = comandoAleatorio(p, x);
          if (!cmd) continue;
          const copia = structuredClone(p);
          try {
            cmd.aplicar(copia);
          } catch (e) {
            if (e instanceof ErroComando) continue;
            throw e;
          }
          const depois = structuredClone(copia);
          cmd.reverter(copia);
          expect(copia).toStrictEqual(p);
          cmd.aplicar(copia);
          expect(copia).toStrictEqual(depois);
          p = depois;
        }
      }),
      { numRuns: 150 },
    );
  });

  it('desfazer tudo volta ao início e refazer tudo volta ao fim (com fusão)', () => {
    fc.assert(
      fc.property(fc.array(acao, { maxLength: 40 }), (acoes) => {
        gerar = criarContador('q');
        configurarFabrica({ gerarId: gerar });
        const inicial = projetoBase();
        let p = inicial;
        let h = H.criarHistorico();
        for (const x of acoes) {
          const cmd = comandoAleatorio(p, x);
          if (!cmd) continue;
          if (x.selar) h = H.selar(h);
          try {
            ({ projeto: p, historico: h } = H.executar(h, p, cmd));
          } catch (e) {
            if (e instanceof ErroComando) continue;
            throw e;
          }
        }
        const final = p;
        let passos = 0;
        for (let r = H.desfazer(h, p); r; r = H.desfazer(h, p)) {
          ({ projeto: p, historico: h } = r);
          passos++;
        }
        expect(p).toStrictEqual(inicial);
        for (let r = H.refazer(h, p); r; r = H.refazer(h, p)) ({ projeto: p, historico: h } = r);
        expect(p).toStrictEqual(final);
        expect(passos).toBe(h.desfazer.length);
      }),
      { numRuns: 150 },
    );
  });

  it('desfazer passo a passo reproduz cada estado intermediário (sem fusão)', () => {
    fc.assert(
      fc.property(fc.array(acao, { maxLength: 30 }), (acoes) => {
        gerar = criarContador('s');
        configurarFabrica({ gerarId: gerar });
        let p = projetoBase();
        let h = H.criarHistorico();
        const estados: Projeto[] = [p];
        for (const x of acoes) {
          const cmd = comandoAleatorio(p, x);
          if (!cmd) continue;
          h = H.selar(h);
          try {
            ({ projeto: p, historico: h } = H.executar(h, p, cmd));
          } catch (e) {
            if (e instanceof ErroComando) continue;
            throw e;
          }
          estados.push(p);
        }
        for (let i = estados.length - 2; i >= 0; i--) {
          ({ projeto: p, historico: h } = H.desfazer(h, p)!);
          expect(p).toStrictEqual(estados[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});
