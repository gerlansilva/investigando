import { describe, expect, it } from 'vitest';
import { criarAtributo, criarCaso, criarColecao, configurarFabrica, criarContador, restaurarFabrica } from '../modelo/fabrica';
import type { Colecao } from '../modelo/tipos';
import { avaliarFormula, recalcularAtributo, recalcularColecao, compilar, tokenizar, criarPrng } from './index';
import type { Valor } from './index';

function montar() {
  configurarFabrica({ gerarId: criarContador('f') });
  const nome = criarAtributo({ nome: 'Nome', tipo: 'texto' });
  const idade = criarAtributo({ nome: 'Idade' });
  const turma = criarAtributo({ nome: 'Turma', tipo: 'categorico' });
  const altura = criarAtributo({ nome: 'Altura do aluno' });
  const idades = [10, 12, 11, 12, 15];
  const colecao = criarColecao('Alunos', [nome, idade, turma, altura], idades.map((v, i) =>
    criarCaso({ [nome.id]: ['Ana', 'Bia', 'Caio', 'Davi', 'Eva'][i]!, [idade.id]: v, [turma.id]: i % 2 ? 'B' : 'A', [altura.id]: 1.5 + i / 10 }),
  ));
  restaurarFabrica();
  return { colecao, ids: { nome: nome.id, idade: idade.id } };
}

const { colecao } = montar();
const globais = { fator: 2, pi: 3.14 };

function calc(formula: string, indiceCaso = 0, col: Colecao = colecao): Valor | string {
  const r = avaliarFormula(formula, { caso: col.casos[indiceCaso]!, colecao: col, globais, rng: criarPrng(1), indice: indiceCaso + 1 });
  return r.ok ? r.valor : `ERRO: ${r.erro.mensagem}`;
}

describe('expressões', () => {
  const tabela: [string, Valor][] = [
    ['1+2*3', 7],
    ['(1+2)*3', 9],
    ['2^3^2', 512],
    ['-2^2', -4],
    ['2^-1', 0.5],
    ['10÷4', 2.5],
    ['2×3', 6],
    ['7 − 2 − 1', 4],
    ['1,5+2,5', 4],
    ['1.5+1', 2.5],
    ['3 > 2 e 2 > 1', true],
    ['3 > 2 e 2 < 1', false],
    ['não 1 > 2', true],
    ['1 = 1 ou 1 = 2', true],
    ['1 <> 1', false],
    ['2 >= 2', true],
    ['"ana" = "ANA"', true],
    ['"a" & "b"', 'ab'],
    ['"x" & 1,5', 'x1,5'],
    ['verdadeiro e falso', false],
    ['se(Idade > 9; "maior"; "menor")', 'maior'],
    ['se(Idade > 10; "maior"; "menor")', 'menor'],
    ['se(Idade > 99; 1)', null],
    ['Idade + fator', 12],
    ['[Idade] * 2', 20],
    ['[Altura do aluno] * 10', 15],
    ['idade + 1', 11],
    ['pi * 2', 6.28],
    ['soma(Idade)', 60],
    ['média(Idade)', 12],
    ['media([Idade])', 12],
    ['MÉDIA(Idade)', 12],
    ['mediana(Idade)', 12],
    ['mínimo(Idade)', 10],
    ['máximo(Idade)', 15],
    ['contagem(Idade)', 5],
    ['contagem()', 5],
    ['contagem(Nome)', 5],
    ['soma(Idade * 2)', 120],
    ['máximo(Idade; 20)', 20],
    ['mínimo(3, 1, 2)', 1],
    ['soma(1,2)', 3],
    ['soma(1,5; 2)', 3.5],
    ['soma((1,5); 2)', 3.5],
    ['sum(Idade)', 60],
    ['mean(Idade)', 12],
    ['count(Idade)', 5],
    ['if(1 = 1; "s"; "n")', 's'],
    ['arredondar(2,567; 2)', 2.57],
    ['arredondar(2.5)', 3],
    ['arredondar(-2.5)', -3],
    ['arredondar(1.005; 2)', 1.01],
    ['round(7.4)', 7],
    ['absoluto(-3)', 3],
    ['abs(3)', 3],
    ['raiz(16)', 4],
    ['sqrt(2) > 1,41', true],
    ['piso(2.9)', 2],
    ['teto(2.1)', 3],
    ['piso((2,9))', 2],
    ['potência(2; 10)', 1024],
    ['concatenar("a"; "b"; 1)', 'ab1'],
    ['concatenar(Nome; " - "; Idade)', 'Ana - 10'],
    ['concat("x")', 'x'],
    ['comprimento("abc")', 3],
    ['maiúsculas("ana")', 'ANA'],
    ['indiceDoCaso()', 1],
    ['caseIndex()', 1],
    ['Idade / 4', 2.5],
  ];

  it.each(tabela)('%s = %j', (formula, esperado) => {
    expect(calc(formula)).toBe(esperado);
  });

  it('resultados dependem do caso', () => {
    expect(calc('Idade * 2', 4)).toBe(30);
    expect(calc('indiceDoCaso()', 4)).toBe(5);
    expect(calc('Nome & "!"', 2)).toBe('Caio!');
  });

  it('valores ausentes propagam nulo', () => {
    const { colecao: c, ids } = montar();
    c.casos[0]!.valores[ids.idade] = null;
    expect(calc('Idade + 1', 0, c)).toBeNull();
    expect(calc('se(Idade > 1; "a"; "b")', 0, c)).toBe('b');
    expect(calc('contagem(Idade)', 0, c)).toBe(4);
    expect(calc('soma(Idade)', 0, c)).toBe(50);
  });
});

describe('estatísticas conferidas à mão', () => {
  it('mediana com quantidade par', () => {
    const { colecao: c, ids } = montar();
    c.casos.pop();
    expect(c.casos.map((k) => k.valores[ids.idade])).toEqual([10, 12, 11, 12]);
    expect(calc('mediana(Idade)', 0, c)).toBe(11.5);
    expect(calc('média(Idade)', 0, c)).toBe(11.25);
  });

  it('desvio padrão amostral de 10,12,11,12,15 é raiz de 3,5', () => {
    expect(calc('desvioPadrão(Idade)') as number).toBeCloseTo(Math.sqrt(3.5), 10);
  });

  it('coleção vazia', () => {
    const { colecao: c } = montar();
    const vazia: Colecao = { ...c, casos: [] };
    const ctx = { caso: { id: 'x', valores: {} }, colecao: vazia, globais };
    const valor = (f: string) => {
      const r = avaliarFormula(f, ctx);
      return r.ok ? r.valor : r.erro.mensagem;
    };
    expect(valor('soma(Idade)')).toBe(0);
    expect(valor('média(Idade)')).toBeNull();
    expect(valor('contagem()')).toBe(0);
  });
});

describe('mensagens de erro', () => {
  const tabela: [string, string][] = [
    ['Altura + 1', "Não achei o atributo 'Altura'"],
    ['[Peso] * 2', "Não achei o atributo 'Peso'"],
    ['xyz(1)', "Não conheço a função 'xyz'"],
    ['1/0', 'Não dá para dividir por zero'],
    ['"abc" * 2', "Não dá para fazer conta com o texto 'abc'"],
    ['2 + Nome', "Não dá para fazer conta com o texto 'Ana'"],
    ['', 'A fórmula está vazia'],
    ['   ', 'A fórmula está vazia'],
    ['1 +', 'A fórmula terminou antes da hora: faltou um valor no final'],
    ['(1+2', 'Faltou fechar o parêntese'],
    ['soma(1; 2', "Faltou fechar o parêntese da função 'soma'"],
    ['1 + 2)', "Sobrou um parêntese ')' sem o que abre"],
    ['1 2', "Não entendi '2' aqui. Faltou um operador, como + ou ×, antes?"],
    ['#', "Não entendi o símbolo '#'"],
    ['"abc', 'Faltou fechar as aspas do texto'],
    ['[Idade', 'Faltou fechar o colchete do nome do atributo'],
    ['*2', "Faltou um valor antes de '*'"],
    ['raiz(-1)', 'Não existe raiz quadrada de número negativo'],
    ['arredondar()', "A função 'arredondar' aceita de 1 a 2 argumentos"],
    ['piso(2,9)', "A função 'piso' precisa de 1 argumento"],
    ['raiz(1; 2)', "A função 'raiz' precisa de 1 argumento"],
    ['soma()', "A função 'soma' precisa de pelo menos 1 argumento"],
    ['indiceDoCaso(1)', "A função 'indiceDoCaso' não recebe argumentos"],
    ['inteiroAleatório(5; 1)', 'O primeiro número precisa ser menor ou igual ao segundo'],
    ['10^1000', 'O resultado ficou grande demais'],
  ];

  it.each(tabela)('%j -> %s', (formula, mensagem) => {
    expect(calc(formula)).toBe(`ERRO: ${mensagem}`);
  });

  it('informa a posição do trecho', () => {
    const r = avaliarFormula('2 * Altura', { caso: colecao.casos[0]!, colecao, globais });
    if (r.ok) throw new Error('esperava erro');
    expect([r.erro.inicio, r.erro.fim, r.erro.trechoEm('2 * Altura')]).toEqual([4, 10, 'Altura']);
    const c = compilar('1 + (2');
    if (c.ok) throw new Error('esperava erro');
    expect(c.erro.inicio).toBe(4);
  });
});

describe('lexer', () => {
  it('vírgula decimal ou separador conforme o contexto', () => {
    expect(tokenizar('f(1,5)').filter((t) => t.tipo === 'num').map((t) => t.valor)).toEqual([1, 5]);
    expect(tokenizar('f(1,5; 2)').filter((t) => t.tipo === 'num').map((t) => t.valor)).toEqual([1.5, 2]);
    expect(tokenizar('1,5').map((t) => t.valor)).toEqual([1.5, undefined]);
  });
});

describe('aleatório', () => {
  it('PRNG semeável é determinístico e uniforme em [0,1)', () => {
    const a = criarPrng(42);
    const b = criarPrng(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(criarPrng(43)()).not.toBe(criarPrng(42)());
    expect(xs.reduce((s, x) => s + x, 0) / 1000).toBeGreaterThan(0.45);
    expect(xs.reduce((s, x) => s + x, 0) / 1000).toBeLessThan(0.55);
  });

  it('funções aleatórias respeitam limites e a semente', () => {
    const ctx = (seed: number) => ({ caso: colecao.casos[0]!, colecao, globais, rng: criarPrng(seed) });
    const valores = Array.from({ length: 200 }, () => 0).map(() => 0);
    const rodar = (f: string, seed: number) => {
      const r = avaliarFormula(f, ctx(seed));
      if (!r.ok) throw r.erro;
      return r.valor as number;
    };
    expect(valores.length).toBe(200);
    for (let s = 0; s < 200; s++) {
      const i = rodar('inteiroAleatório(1; 6)', s);
      expect(Number.isInteger(i) && i >= 1 && i <= 6).toBe(true);
      const x = rodar('aleatório(10; 20)', s);
      expect(x >= 10 && x < 20).toBe(true);
    }
    expect(rodar('aleatório()', 7)).toBe(rodar('aleatório()', 7));
    const vistos = new Set(Array.from({ length: 200 }, (_, s) => rodar('inteiroAleatório(1; 6)', s)));
    expect(vistos.size).toBe(6);
  });
});

describe('recálculo da coleção', () => {
  function comCalculados(formulas: [string, string][]) {
    configurarFabrica({ gerarId: criarContador('r') });
    const base = montar().colecao;
    const novos = formulas.map(([nome, formula]) => criarAtributo({ nome, formula }));
    restaurarFabrica();
    return { ...base, atributos: [...base.atributos, ...novos] } as Colecao;
  }

  it('calcula atributo para todos os casos', () => {
    const c = comCalculados([['Dobro', 'Idade * 2']]);
    const r = recalcularAtributo(c, c.atributos[4]!.id, globais);
    expect(r.valores).toEqual([20, 24, 22, 24, 30]);
    expect(r.erros.every((e) => e === null)).toBe(true);
  });

  it('resolve dependência entre calculados independentemente da ordem', () => {
    const c = comCalculados([['Quad', 'Dobro * Dobro'], ['Dobro', 'Idade * 2']]);
    const r = recalcularColecao(c, globais);
    expect(r[c.atributos[4]!.id]!.valores).toEqual([400, 576, 484, 576, 900]);
  });

  it('agregação por caso: diferença para a média', () => {
    const c = comCalculados([['Desvio', 'Idade - média(Idade)']]);
    expect(recalcularColecao(c, globais)[c.atributos[4]!.id]!.valores).toEqual([-2, 0, -1, 0, 3]);
  });

  it('erro de fórmula vira nulo com mensagem por caso', () => {
    const c = comCalculados([['Ruim', 'Altura * 2']]);
    const r = recalcularAtributo(c, c.atributos[4]!.id, globais);
    expect(r.valores).toEqual([null, null, null, null, null]);
    expect(r.erros[0]?.mensagem).toBe("Não achei o atributo 'Altura'");
  });

  it('detecta autorreferência e ciclos', () => {
    const c = comCalculados([['A', 'B + 1'], ['B', 'A + 1'], ['C', 'C + 1']]);
    const r = recalcularColecao(c, globais);
    expect(r[c.atributos[4]!.id]!.erros[0]?.mensagem).toMatch(/dependem uma da outra/);
    expect(r[c.atributos[6]!.id]!.erros[0]?.mensagem).toMatch(/usa o próprio atributo/);
  });

  it('aleatório recalcula de forma determinística com a mesma semente', () => {
    const c = comCalculados([['Sorteio', 'inteiroAleatório(1; 100)']]);
    const a = recalcularAtributo(c, c.atributos[4]!.id, globais, 5).valores;
    const b = recalcularAtributo(c, c.atributos[4]!.id, globais, 5).valores;
    const d = recalcularAtributo(c, c.atributos[4]!.id, globais, 6).valores;
    expect(a).toEqual(b);
    expect(a).not.toEqual(d);
  });

  it('booleano vira texto verdadeiro/falso', () => {
    const c = comCalculados([['Adulto', 'Idade >= 12']]);
    expect(recalcularAtributo(c, c.atributos[4]!.id, globais).valores).toEqual(['falso', 'verdadeiro', 'falso', 'verdadeiro', 'verdadeiro']);
  });
});
