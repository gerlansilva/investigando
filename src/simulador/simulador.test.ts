import { describe, expect, it } from 'vitest';
import { criarPrng } from '../formulas';
import {
  coletarEstatistica, colunasPadrao, configDoEstado, criarColetor, criarExecutor, ehRegistroEstatistica, ErroSimulador, estadoPadrao,
  estatisticaDoEstado, executar, executarRepeticoes, formulaDeContagem, indicePorSomaCumulativa, lerEstado, resumirValores,
  validarRegistroEstatistica, type ConfigSimulacao, type Dispositivo,
} from './index';

const roleta = (...proporcoes: number[]): Dispositivo => ({
  tipo: 'roleta', setores: proporcoes.map((p, i) => ({ nome: `S${i + 1}`, proporcao: p, cor: 'x' })),
});
const misturador = (quantidades: number[], reposicao: boolean, repor = true): Dispositivo => ({
  tipo: 'misturador', bolas: quantidades.map((q, i) => ({ nome: `B${i + 1}`, quantidade: q, cor: 'x' })), reposicao, reporEntreRepeticoes: repor,
});
const config = (dispositivo: Dispositivo, itens = 1): ConfigSimulacao => ({ dispositivo, itensPorRepeticao: itens, colunas: colunasPadrao() });
const nomes = (rs: ReturnType<typeof executarRepeticoes>) => rs.flatMap((r) => r.itens.map((i) => i.nome));
const erro = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErroSimulador);
    return (e as Error).message;
  }
  throw new Error('não lançou erro');
};

describe('soma cumulativa', () => {
  it('escolhe o intervalo certo, inclusive nas bordas', () => {
    expect(indicePorSomaCumulativa([1, 3], 0)).toBe(0);
    expect(indicePorSomaCumulativa([1, 3], 0.999)).toBe(0);
    expect(indicePorSomaCumulativa([1, 3], 1)).toBe(1);
    expect(indicePorSomaCumulativa([1, 3], 3.999)).toBe(1);
  });
});

describe('roleta', () => {
  it('é determinística com a mesma semente e muda com outra', () => {
    const c = config(roleta(1, 1, 1), 5);
    const a = nomes(executarRepeticoes(c, 20, criarPrng(42)));
    const b = nomes(executarRepeticoes(c, 20, criarPrng(42)));
    const d = nomes(executarRepeticoes(c, 20, criarPrng(43)));
    expect(a).toEqual(b);
    expect(a).not.toEqual(d);
  });

  it('respeita as proporções em uma simulação grande', () => {
    const rs = executarRepeticoes(config(roleta(1, 3), 10), 2000, criarPrng(7));
    const todos = nomes(rs);
    expect(todos).toHaveLength(20000);
    const p1 = todos.filter((n) => n === 'S1').length / todos.length;
    expect(Math.abs(p1 - 0.25)).toBeLessThan(0.015);
  });

  it('proporções não precisam somar 1 (valem como pesos)', () => {
    const todos = nomes(executarRepeticoes(config(roleta(50, 50, 100), 10), 1000, criarPrng(3)));
    const p3 = todos.filter((n) => n === 'S3').length / todos.length;
    expect(Math.abs(p3 - 0.5)).toBeLessThan(0.02);
  });

  it('um único setor sempre sai', () => {
    const rs = executarRepeticoes(config(roleta(1), 3), 50, criarPrng(1));
    expect(new Set(nomes(rs))).toEqual(new Set(['S1']));
  });

  it('um setor com proporção minúscula quase nunca sai, mas pode sair', () => {
    const todos = nomes(executarRepeticoes(config(roleta(1e-9, 1), 10), 100, criarPrng(5)));
    expect(todos.filter((n) => n === 'S1').length).toBe(0);
  });

  it('erros em português: sem setores, proporção zero ou negativa, nome vazio', () => {
    expect(erro(() => executar(config(roleta()), criarPrng(1)))).toBe('A roleta precisa ter pelo menos um setor.');
    expect(erro(() => executar(config(roleta(1, 0)), criarPrng(1)))).toBe("A proporção do setor 'S2' precisa ser um número maior que zero.");
    expect(erro(() => executar(config(roleta(-2, 1)), criarPrng(1)))).toContain("setor 'S1'");
    expect(erro(() => executar(config(roleta(Number.NaN, 1)), criarPrng(1)))).toContain('maior que zero');
    const semNome: Dispositivo = { tipo: 'roleta', setores: [{ nome: ' ', proporcao: 1, cor: 'x' }] };
    expect(erro(() => executar(config(semNome), criarPrng(1)))).toBe('Dê um nome ao setor 1 da roleta.');
  });

  it('itens por repetição inválidos', () => {
    expect(erro(() => executar(config(roleta(1), 0), criarPrng(1)))).toContain('itens por repetição');
    expect(erro(() => executar(config(roleta(1), 2.5), criarPrng(1)))).toContain('número inteiro');
  });

  it('valores numéricos viram número', () => {
    const d: Dispositivo = { tipo: 'roleta', setores: [{ nome: '3', proporcao: 1, cor: 'x' }, { nome: '2,5', proporcao: 1, cor: 'x' }] };
    const r = executar(config(d, 20), criarPrng(9));
    expect(r.itens.every((i) => typeof i.valor === 'number')).toBe(true);
    expect(new Set(r.itens.map((i) => i.valor))).toEqual(new Set([3, 2.5]));
  });
});

describe('misturador', () => {
  it('com reposição, o mesmo tipo pode sair mais vezes que a quantidade', () => {
    const todos = nomes(executarRepeticoes(config(misturador([1, 1], true), 10), 10, criarPrng(11)));
    expect(todos.filter((n) => n === 'B1').length).toBeGreaterThan(1);
  });

  it('com reposição, as proporções seguem as quantidades', () => {
    const todos = nomes(executarRepeticoes(config(misturador([3, 1], true), 10), 2000, criarPrng(2)));
    expect(Math.abs(todos.filter((n) => n === 'B1').length / todos.length - 0.75)).toBeLessThan(0.015);
  });

  it('sem reposição, nunca repete além da quantidade e esvazia exatamente', () => {
    const c = config(misturador([3, 2, 1], false), 6);
    for (let semente = 1; semente <= 200; semente++) {
      const r = executar(c, criarPrng(semente));
      const contagem = (n: string) => r.itens.filter((i) => i.nome === n).length;
      expect([contagem('B1'), contagem('B2'), contagem('B3')]).toEqual([3, 2, 1]);
    }
  });

  it('sem reposição e repondo entre repetições: cada repetição começa cheia', () => {
    const rs = executarRepeticoes(config(misturador([2, 2], false, true), 4), 30, criarPrng(4));
    for (const r of rs) expect(r.itens.filter((i) => i.nome === 'B1')).toHaveLength(2);
  });

  it('sem reposição e sem repor entre repetições: acaba e explica', () => {
    const c = config(misturador([2, 1], false, false), 2);
    const msg = erro(() => executarRepeticoes(c, 3, criarPrng(1)));
    expect(msg).toContain('Na repetição 2');
    expect(msg).toContain('Acabaram as bolas');
    expect(executarRepeticoes(c, 1, criarPrng(1))).toHaveLength(1);
  });

  it('itens por repetição maior que as bolas, sem reposição: mensagem clara', () => {
    const msg = erro(() => executar(config(misturador([2, 1], false), 5), criarPrng(1)));
    expect(msg).toBe('Você pediu 5 itens por repetição, mas o misturador só tem 3 bolas e a reposição está desligada. Ligue a reposição ou peça no máximo 3.');
    expect(erro(() => executar(config(misturador([1], false), 2), criarPrng(1)))).toContain('só tem 1 bola e');
    expect(() => executar(config(misturador([2, 1], true), 5), criarPrng(1))).not.toThrow();
  });

  it('um tipo só de bola', () => {
    const r = executar(config(misturador([4], false), 4), criarPrng(1));
    expect(r.itens.map((i) => i.nome)).toEqual(['B1', 'B1', 'B1', 'B1']);
  });

  it('erros: sem bolas, quantidade zero ou quebrada', () => {
    expect(erro(() => executar(config(misturador([], true)), criarPrng(1)))).toBe('O misturador precisa ter pelo menos uma bola.');
    expect(erro(() => executar(config(misturador([0, 1], true)), criarPrng(1)))).toContain("bolas 'B1' precisa ser um número inteiro maior que zero");
    expect(erro(() => executar(config(misturador([1.5], true)), criarPrng(1)))).toContain('número inteiro');
    expect(erro(() => executar(config(misturador([-1], true)), criarPrng(1)))).toContain('maior que zero');
  });
});

describe('contador', () => {
  const ate = (n: number): Dispositivo => ({ tipo: 'contador', modo: 'ate', ate: n, valores: [] });

  it('conta 1..N sem aleatoriedade (o rng nem é usado)', () => {
    const rng = () => {
      throw new Error('o contador não deve sortear');
    };
    const r = executar(config(ate(5), 5), rng);
    expect(r.itens.map((i) => i.valor)).toEqual([1, 2, 3, 4, 5]);
  });

  it('continua entre repetições e volta ao começo', () => {
    const rs = executarRepeticoes(config(ate(3), 2), 3, criarPrng(1));
    expect(rs.flatMap((r) => r.itens.map((i) => i.valor))).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('valores listados, números e textos', () => {
    const d: Dispositivo = { tipo: 'contador', modo: 'lista', ate: 0, valores: ['10', 'a', ' 2,5 '] };
    const r = executar(config(d, 3), criarPrng(1));
    expect(r.itens.map((i) => i.valor)).toEqual([10, 'a', 2.5]);
  });

  it('erros', () => {
    expect(erro(() => executar(config(ate(0)), criarPrng(1)))).toContain('número inteiro de 1 a');
    expect(erro(() => executar(config({ tipo: 'contador', modo: 'lista', ate: 0, valores: [' ', ''] }), criarPrng(1)))).toBe('Escreva pelo menos um valor para o contador.');
  });
});

describe('colunas de resultado', () => {
  const c: ConfigSimulacao = {
    dispositivo: { tipo: 'contador', modo: 'lista', ate: 0, valores: ['1', '2', '3', '4'] },
    itensPorRepeticao: 4,
    colunas: [
      { id: 'a', nome: 'Rep', tipo: 'repeticao' },
      { id: 'b', nome: 'Item', tipo: 'item' },
      { id: 'c', nome: 'Valor', tipo: 'valor' },
      { id: 'd', nome: 'Soma', tipo: 'soma' },
      { id: 'e', nome: 'Média', tipo: 'media' },
      { id: 'f', nome: 'Mín', tipo: 'minimo' },
      { id: 'g', nome: 'Máx', tipo: 'maximo' },
      { id: 'h', nome: 'Quantos 3', tipo: 'contagem', elemento: '3' },
    ],
  };

  it('uma linha por item, com resumos repetidos na repetição', () => {
    const r = executar(c, criarPrng(1));
    expect(r.linhas).toHaveLength(4);
    expect(r.linhas[2]).toEqual({ a: 1, b: 3, c: 3, d: 10, e: 2.5, f: 1, g: 4, h: 1 });
  });

  it('soma de textos fica vazia (null)', () => {
    const r = executar({ ...c, dispositivo: { tipo: 'contador', modo: 'lista', ate: 0, valores: ['a', 'b', 'c', 'd'] } }, criarPrng(1));
    expect(r.linhas[0]!.d).toBeNull();
  });

  it('erros: coluna sem nome, nome repetido, contagem sem elemento, nenhuma coluna', () => {
    const base = config(roleta(1));
    expect(erro(() => executar({ ...base, colunas: [] }, criarPrng(1)))).toContain('pelo menos uma coluna');
    expect(erro(() => executar({ ...base, colunas: [{ id: 'a', nome: ' ', tipo: 'valor' }] }, criarPrng(1)))).toContain('precisa de um nome');
    expect(erro(() => executar({ ...base, colunas: [{ id: 'a', nome: 'X', tipo: 'valor' }, { id: 'b', nome: 'x', tipo: 'item' }] }, criarPrng(1)))).toContain("duas colunas chamadas 'x'");
    expect(erro(() => executar({ ...base, colunas: [{ id: 'a', nome: 'N', tipo: 'contagem' }] }, criarPrng(1)))).toContain("a coluna 'N' deve contar");
  });
});

describe('executar / executarRepeticoes', () => {
  it('gera `itensPorRepeticao` itens e numera as repetições', () => {
    const rs = executarRepeticoes(config(roleta(1, 1), 4), 3, criarPrng(1));
    expect(rs.map((r) => r.numero)).toEqual([1, 2, 3]);
    expect(rs.every((r) => r.itens.length === 4 && r.linhas.length === 4)).toBe(true);
  });

  it('número de repetições inválido', () => {
    expect(erro(() => executarRepeticoes(config(roleta(1)), 0, criarPrng(1)))).toContain('repetições');
    expect(erro(() => executarRepeticoes(config(roleta(1)), 1e9, criarPrng(1)))).toContain('100.000');
  });

  it('o executor guarda estado entre chamadas', () => {
    const ex = criarExecutor(config(misturador([1, 1], false, false), 1), criarPrng(1));
    ex.proxima();
    ex.proxima();
    expect(ex.repeticoesFeitas).toBe(2);
    expect(() => ex.proxima()).toThrow(/Acabaram as bolas/);
  });
});

describe('coletar estatística', () => {
  const moeda = config(roleta(1, 1), 10);

  it('conta um elemento por repetição (uma linha por repetição)', () => {
    const r = coletarEstatistica(moeda, { formula: 'contagem(se([Resultado] = "S1", 1))', rotulo: 'Caras' }, 200, criarPrng(8));
    expect(r.linhas).toHaveLength(200);
    expect(r.motivo).toBe('completo');
    expect(r.tipo).toBe('numerico');
    expect(r.linhas.map((l) => l.repeticao)).toEqual(Array.from({ length: 200 }, (_, i) => i + 1));
    const media = (r.linhas.reduce((s, l) => s + (l.valor as number), 0)) / 200;
    expect(Math.abs(media - 5)).toBeLessThan(0.4);
    expect(r.linhas.every((l) => Number.isInteger(l.valor) && (l.valor as number) >= 0 && (l.valor as number) <= 10)).toBe(true);
  });

  it('é determinística com a semente', () => {
    const est = { formula: 'média(Resultado)', rotulo: 'M' };
    const dado = config({ tipo: 'roleta', setores: [{ nome: '1', proporcao: 1, cor: 'x' }, { nome: '6', proporcao: 1, cor: 'x' }] }, 5);
    const a = coletarEstatistica(dado, est, 50, criarPrng(5));
    const b = coletarEstatistica(dado, est, 50, criarPrng(5));
    expect(a).toEqual(b);
  });

  it('média e soma sobre valores numéricos', () => {
    const c = config({ tipo: 'contador', modo: 'ate', ate: 4, valores: [] }, 4);
    expect(coletarEstatistica(c, { formula: 'média(Resultado)', rotulo: 'M' }, 2, criarPrng(1)).linhas.map((l) => l.valor)).toEqual([2.5, 2.5]);
    expect(coletarEstatistica(c, { formula: 'soma([Resultado])', rotulo: 'S' }, 1, criarPrng(1)).linhas[0]!.valor).toBe(10);
  });

  it('a fórmula pode ser uma comparação (vira texto verdadeiro/falso)', () => {
    const r = coletarEstatistica(config(roleta(1), 1), { formula: 'contagem(se([Resultado] = "S1", 1)) = 1', rotulo: 'Saiu' }, 3, criarPrng(1));
    expect(r.linhas.map((l) => l.valor)).toEqual(['verdadeiro', 'verdadeiro', 'verdadeiro']);
    expect(r.tipo).toBe('categorico');
  });

  it('formulaDeContagem monta a fórmula dos anos iniciais', () => {
    expect(formulaDeContagem('Resultado', 'Cara')).toBe('contagem(se([Resultado] = "Cara", 1))');
    expect(formulaDeContagem('Resultado', 'a"b')).toBe(`contagem(se([Resultado] = 'a"b', 1))`);
    const r = coletarEstatistica(moeda, { formula: formulaDeContagem('Resultado', 'S2'), rotulo: 'x' }, 5, criarPrng(1));
    expect(r.linhas).toHaveLength(5);
  });

  it('rodar até que: para quando a condição fica verdadeira', () => {
    const c = config(roleta(1, 1), 1);
    const est = { formula: 'contagem(se([Resultado] = "S1", 1))', rotulo: 'Caras', rodarAteQue: '[Caras] = 1' };
    const r = coletarEstatistica(c, est, 999, criarPrng(3));
    expect(r.motivo).toBe('condicao');
    expect(r.linhas.at(-1)!.valor).toBe(1);
    expect(r.linhas.slice(0, -1).every((l) => l.valor === 0)).toBe(true);
  });

  it('rodar até que com agregação sobre as estatísticas acumuladas', () => {
    const c = config(roleta(1, 1), 1);
    const est = { formula: 'contagem(se([Resultado] = "S1", 1))', rotulo: 'Caras', rodarAteQue: 'soma(Caras) >= 5' };
    const r = coletarEstatistica(c, est, 1, criarPrng(3));
    expect(r.motivo).toBe('condicao');
    expect(r.linhas.reduce((s, l) => s + (l.valor as number), 0)).toBe(5);
  });

  it('rodar até que: o limite de segurança impede laço infinito', () => {
    const r = coletarEstatistica(config(roleta(1), 1), { formula: 'contagem()', rotulo: 'x', rodarAteQue: 'falso' }, 1, criarPrng(1));
    expect(r.motivo).toBe('limite');
    expect(r.linhas).toHaveLength(10_000);
    const r2 = coletarEstatistica(config(roleta(1), 1), { formula: 'contagem()', rotulo: 'x', rodarAteQue: 'falso', limite: 25 }, 1, criarPrng(1));
    expect(r2.linhas).toHaveLength(25);
    expect(erro(() => coletarEstatistica(config(roleta(1), 1), { formula: '1', rotulo: 'x', rodarAteQue: 'falso', limite: 10_001 }, 1, criarPrng(1)))).toContain('1 a 10.000');
  });

  it('erros em português: fórmula vazia, inválida, atributo inexistente, função desconhecida, condição inválida', () => {
    const f = (est: Partial<{ formula: string; rotulo: string; rodarAteQue: string }>) =>
      erro(() => coletarEstatistica(moeda, { formula: 'contagem()', rotulo: 'x', ...est }, 3, criarPrng(1)));
    expect(f({ formula: '  ' })).toContain('Escreva a fórmula da estatística');
    expect(f({ formula: 'contagem(' })).toMatch(/^Problema na fórmula "contagem\(":/);
    expect(f({ formula: 'soma([Inexistente])' })).toContain("Não achei o atributo 'Inexistente'");
    expect(f({ formula: 'chuva(Resultado)' })).toContain("Não conheço a função 'chuva'");
    expect(f({ formula: '1/0' })).toContain('dividir por zero');
    expect(f({ rodarAteQue: '[x] >' })).toContain('Problema na fórmula');
    expect(f({ rodarAteQue: '[Nada] > 1' })).toContain('Problema na condição');
    expect(f({ rotulo: 'repetição' })).toContain("não pode ser 'Repetição'");
  });

  it('número de repetições inválido', () => {
    expect(erro(() => coletarEstatistica(moeda, { formula: 'contagem()', rotulo: 'x' }, 0, criarPrng(1)))).toContain('repetições');
  });

  it('o coletor de estatística propaga erros de configuração do dispositivo', () => {
    expect(erro(() => criarColetor(config(roleta()), { formula: 'contagem()', rotulo: 'x' }, criarPrng(1)))).toContain('pelo menos um setor');
  });
});

describe('histórico de estatísticas', () => {
  const registro = {
    id: 'h1', objetoId: 'o1', criadoEm: '2026-01-01T00:00:00.000Z', rotulo: 'Caras', formula: 'contagem()', dispositivo: 'roleta',
    itensPorRepeticao: 10, repeticoes: 100, semente: 5, colecaoId: 'c1', resumo: { n: 100, media: 5, minimo: 1, maximo: 9 },
  };

  it('valida um registro correto e rejeita os malformados em português', () => {
    expect(validarRegistroEstatistica(registro)).toEqual(registro);
    expect(ehRegistroEstatistica(registro)).toBe(true);
    expect(() => validarRegistroEstatistica({ ...registro, dispositivo: 'dado' })).toThrow(/dispositivo/);
    expect(() => validarRegistroEstatistica({ ...registro, resumo: undefined })).toThrow(/O registro da estatística está incompleto/);
    expect(ehRegistroEstatistica(null)).toBe(false);
  });

  it('resume valores', () => {
    expect(resumirValores([1, 2, 3, null, 'a'])).toEqual({ n: 5, media: 2, minimo: 1, maximo: 3 });
    expect(resumirValores(['a'])).toEqual({ n: 1, media: null, minimo: null, maximo: null });
    expect(resumirValores([])).toEqual({ n: 0, media: null, minimo: null, maximo: null });
  });
});

describe('estado do objeto', () => {
  it('estado vazio vira o padrão e o padrão gera uma configuração válida', () => {
    const e = lerEstado({});
    expect(e).toEqual(estadoPadrao());
    expect(e.dispositivo).toBe('roleta');
    expect(() => executar(configDoEstado(e), criarPrng(1))).not.toThrow();
    expect(lerEstado(undefined)).toEqual(estadoPadrao());
    expect(lerEstado('lixo')).toEqual(estadoPadrao());
  });

  it('campos inválidos voltam ao padrão sem perder os válidos', () => {
    const e = lerEstado({ repeticoes: 'muitas', itensPorRepeticao: 7, dispositivo: 'misturador' });
    expect(e.repeticoes).toBe(estadoPadrao().repeticoes);
    expect(e.itensPorRepeticao).toBe(7);
    expect(e.dispositivo).toBe('misturador');
  });

  it('estatística simples dos anos iniciais usa o valor escolhido', () => {
    const e = { ...estadoPadrao(), estatistica: { ...estadoPadrao().estatistica, valorContado: 'Coroa' } };
    const est = estatisticaDoEstado(e, true);
    expect(est.formula).toBe('contagem(se([Resultado] = "Coroa", 1))');
    expect(est.rotulo).toBe('Quantidade de Coroa');
    expect(coletarEstatistica(configDoEstado(e), est, 4, criarPrng(2)).linhas).toHaveLength(4);
    // valor que não existe mais: cai no primeiro
    const outro = { ...e, estatistica: { ...e.estatistica, valorContado: 'Sumiu' } };
    expect(estatisticaDoEstado(outro, true).formula).toContain('"Cara"');
  });

  it('estatística dos anos finais usa a fórmula e a condição', () => {
    const e = { ...estadoPadrao(), estatistica: { ...estadoPadrao().estatistica, formula: 'contagem()', rodarAteQue: 'falso', usarRodarAteQue: true, limite: 30 } };
    expect(estatisticaDoEstado(e, false)).toEqual({ formula: 'contagem()', rotulo: 'Estatística', rodarAteQue: 'falso', limite: 30 });
    const sem = { ...e, estatistica: { ...e.estatistica, usarRodarAteQue: false } };
    expect(estatisticaDoEstado(sem, false).rodarAteQue).toBeUndefined();
  });

  it('o contador do estado separa a lista por vírgula ou ponto e vírgula', () => {
    const e = { ...estadoPadrao(), dispositivo: 'contador' as const, contador: { modo: 'lista' as const, ate: 3, valores: '1, 2;3\n4' } };
    expect(configDoEstado(e).dispositivo).toMatchObject({ tipo: 'contador', valores: ['1', '2', '3', '4'] });
  });
});
