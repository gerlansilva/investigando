import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { agruparCategorias, escalaLinear, gradeCompacta, separarCategorico, separarNumerico } from './separar';

describe('separar categórico', () => {
  const op = { largura: 300, altura: 100, diametro: 10 };
  it('vazio', () => {
    expect(separarCategorico([], op)).toEqual({ pontos: [], colunas: [] });
  });
  it('um ponto: centro da única coluna', () => {
    const r = separarCategorico(['a'], op);
    expect(r.pontos[0]).toEqual({ x: 150, y: 50 });
    expect(r.colunas).toHaveLength(1);
  });
  it('colunas iguais e na ordem escolhida; categorias com um só caso', () => {
    const r = separarCategorico(['a', 'b', 'c'], { ...op, ordem: ['c', 'a', 'b'] });
    expect(r.colunas.map((c) => c.categoria)).toEqual(['c', 'a', 'b']);
    expect(r.colunas.map((c) => c.fim - c.ini)).toEqual([100, 100, 100]);
    expect(r.pontos[2]!.x).toBe(50); // 'c' na primeira coluna
    expect(r.pontos[0]!.x).toBe(150);
  });
  it('nulos formam "(sem valor)" por último', () => {
    const r = separarCategorico(['a', null, 'a'], op);
    expect(r.colunas.map((c) => c.categoria)).toEqual(['a', '(sem valor)']);
  });
  it('grade compacta distribui sem sobrepor quando cabe', () => {
    const g = gradeCompacta(12, 100, 100, 10);
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++)
        expect(Math.hypot(g[i]!.dx - g[j]!.dx, g[i]!.dy - g[j]!.dy)).toBeGreaterThanOrEqual(10 - 1e-9);
  });
  it('valores iguais: mesma categoria', () => {
    const r = separarCategorico(['x', 'x', 'x', 'x'], op);
    expect(r.colunas).toHaveLength(1);
    expect(new Set(r.pontos.map((p) => `${p.x},${p.y}`)).size).toBe(4);
  });
  it('agruparCategorias respeita a ordem e acrescenta as demais', () => {
    expect(agruparCategorias(['b', 'a', 'c'], ['c']).categorias).toEqual(['c', 'b', 'a']);
  });
});

describe('separar numérico', () => {
  it('escala linear nos extremos e no meio', () => {
    const r = separarNumerico([0, 5, 10], { inicio: 10, fim: 110 });
    expect(r.posicoes).toEqual([10, 60, 110]);
    expect(r.dominio).toEqual([0, 10]);
  });
  it('domínio explícito e valores fora presos às extremidades', () => {
    const r = separarNumerico([-5, 50, 200], { inicio: 0, fim: 100, dominio: [0, 100] });
    expect(r.posicoes).toEqual([0, 50, 100]);
  });
  it('vazio, só nulos, um ponto, valores iguais', () => {
    expect(separarNumerico([], { inicio: 0, fim: 10 })).toEqual({ posicoes: [], dominio: null });
    expect(separarNumerico([null], { inicio: 0, fim: 10 }).posicoes).toEqual([null]);
    expect(separarNumerico([3], { inicio: 0, fim: 10 }).posicoes).toEqual([5]);
    expect(separarNumerico([3, 3], { inicio: 0, fim: 10 }).posicoes).toEqual([5, 5]);
  });
  it('nulos ficam null', () => {
    expect(separarNumerico([1, null, 3], { inicio: 0, fim: 2 }).posicoes).toEqual([0, null, 2]);
  });
  it('escalaLinear degenerada', () => {
    expect(escalaLinear([1, 1], [0, 10]).aplicar(1)).toBe(5);
  });
  it('propriedade: posições dentro da imagem', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -1e5, max: 1e5, noNaN: true })), (v) => {
        for (const p of separarNumerico(v, { inicio: 7, fim: 93 }).posicoes)
          if (p !== null) {
            expect(p).toBeGreaterThanOrEqual(7 - 1e-9);
            expect(p).toBeLessThanOrEqual(93 + 1e-9);
          }
      }),
    );
  });
  it('propriedade: grade e colunas ficam dentro da área', () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { nil: null }), { maxLength: 400 }),
        fc.integer({ min: 60, max: 900 }),
        fc.integer({ min: 40, max: 600 }),
        fc.integer({ min: 2, max: 30 }),
        (cats, largura, altura, d) => {
          const r = separarCategorico(cats, { largura, altura, diametro: d });
          r.pontos.forEach((p) => {
            expect(p.x).toBeGreaterThanOrEqual(-1e-9);
            expect(p.x).toBeLessThanOrEqual(largura + 1e-9);
            expect(p.y).toBeGreaterThanOrEqual(-1e-9);
            expect(p.y).toBeLessThanOrEqual(altura + 1e-9);
          });
        },
      ),
    );
  });
});
