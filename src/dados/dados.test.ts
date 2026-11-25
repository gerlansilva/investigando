import { describe, expect, it } from 'vitest';
import { BASES } from './bases';
import { colecaoDaBase } from './colecaoDaBase';
import { colecaoDeCsv, ErroCsv, lerCsv } from './csv';
import { validarProjeto } from '../modelo/esquema';
import { criarProjeto } from '../modelo/fabrica';

describe('bases embutidas', () => {
  it('cada linha tem um valor por atributo e todas trazem fonte e licença', () => {
    for (const b of BASES) {
      expect(b.fonte.length).toBeGreaterThan(10);
      expect(b.licenca).toBeTruthy();
      for (const l of b.linhas) expect(l.length).toBe(b.atributos.length);
    }
  });
  it('pinguins: 344 casos e coleção válida no projeto', () => {
    const base = BASES.find((b) => b.id === 'pinguins')!;
    const c = colecaoDaBase(base);
    expect(c.casos).toHaveLength(344);
    const p = criarProjeto();
    p.colecoes.push(c);
    expect(() => validarProjeto(p)).not.toThrow();
  });
  it('zoológico: 100 animais sem o registro "girl"', () => {
    const c = colecaoDaBase(BASES.find((b) => b.id === 'zoologico')!);
    expect(c.casos).toHaveLength(100);
    expect(c.atributos[0]!.nome).toBe('Animal');
  });
});

describe('CSV', () => {
  it('lê aspas, vírgulas e ponto e vírgula', () => {
    expect(lerCsv('a,b\n"x, y",2\n').linhas).toEqual([['a', 'b'], ['x, y', '2']]);
    expect(lerCsv('a;b\n1,5;2').separador).toBe(';');
  });
  it('infere número, categoria e texto, e trata ausentes', () => {
    const c = colecaoDeCsv('nome;peso;cor\nAna;1,5;azul\nBia;2;azul\nCaio;NA;verde\nDani;3;verde\n', 'Teste');
    expect(c.atributos.map((a) => a.tipo)).toEqual(['texto', 'numerico', 'categorico']);
    expect(c.casos[0]!.valores[c.atributos[1]!.id]).toBe(1.5);
    expect(c.casos[2]!.valores[c.atributos[1]!.id]).toBeNull();
  });
  it('recusa arquivo sem dados', () => {
    expect(() => colecaoDeCsv('so,titulos', 'x')).toThrow(ErroCsv);
  });
});
