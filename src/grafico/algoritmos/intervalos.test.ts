import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  MAX_MARCAS, atribuirIntervalos, classesSturges, definirIntervalos, indiceDoIntervalo, larguraSturges, marcasBonitas, rotuloIntervalo,
} from './intervalos';

/** Execuções das propriedades: padrão do teste, ou FC_NUM_RUNS (e FC_SEED) para varreduras longas. */
const rodadas = (padrao: number): { numRuns: number; seed?: number } => ({
  numRuns: Number(process.env.FC_NUM_RUNS) || padrao,
  ...(process.env.FC_SEED ? { seed: Number(process.env.FC_SEED) } : {}),
});

describe('intervalos', () => {
  it('vazio e só nulos', () => {
    expect(definirIntervalos([]).quantidade).toBe(0);
    const d = definirIntervalos([null, null]);
    expect(d.quantidade).toBe(0);
    expect(indiceDoIntervalo(3, d)).toBe(-1);
  });
  it('um ponto e valores iguais: um intervalo', () => {
    for (const v of [[7], [5, 5, 5]]) {
      const d = definirIntervalos(v);
      expect(d.quantidade).toBe(1);
      expect(d.inicio).toBe(v[0]);
      expect(atribuirIntervalos(v, d).every((i) => i === 0)).toBe(true);
    }
  });
  it('Sturges: classes e largura', () => {
    expect(classesSturges(8)).toBe(4);
    expect(classesSturges(100)).toBe(8);
    expect(larguraSturges([0, 100, 50, 25, 75, 10, 90, 60], false)).toBe(25);
  });
  it('início = piso(min/largura) × largura', () => {
    const d = definirIntervalos([13, 27, 41], { largura: 10 });
    expect(d.inicio).toBe(10);
    expect(d.limites).toEqual([10, 20, 30, 40, 50]);
  });
  it('mínimo e máximo exatamente no limite; último intervalo fechado à direita', () => {
    const v = [10, 20, 30, 40];
    const d = definirIntervalos(v, { largura: 10 });
    expect(d.inicio).toBe(10);
    expect(d.quantidade).toBe(3);
    expect(atribuirIntervalos(v, d)).toEqual([0, 1, 2, 2]); // 40 cai no último ([30; 40])
    expect(d.rotulos).toEqual(['[10; 20[', '[20; 30[', '[30; 40]']);
  });
  it('limite interno pertence ao intervalo à direita', () => {
    const d = definirIntervalos([0, 5, 10, 15], { largura: 5 });
    expect(atribuirIntervalos([0, 5, 10, 15], d)).toEqual([0, 1, 2, 2]);
  });
  it('ruído de ponto flutuante: 0,3 em largura 0,1', () => {
    const d = definirIntervalos([0.1, 0.2, 0.3], { largura: 0.1 });
    expect(d.inicio).toBe(0.1);
    expect(d.quantidade).toBe(2);
    expect(atribuirIntervalos([0.1, 0.2, 0.3], d)).toEqual([0, 1, 1]);
  });
  it('rótulos com vírgula decimal', () => {
    expect(rotuloIntervalo(0.5, 1, false, true)).toBe('[0,5; 1[');
    expect(definirIntervalos([0.5, 2], { largura: 0.5, virgulaDecimal: true }).rotulos.at(-1)).toBe('[1,5; 2]');
  });
  it('largura inválida cai na regra de Sturges', () => {
    expect(definirIntervalos([0, 10], { largura: -3 }).largura).toBeGreaterThan(0);
  });
  it('ignora nulos', () => {
    const d = definirIntervalos([null, 1, 9, null], { largura: 4 });
    expect(d.inicio).toBe(0);
    expect(indiceDoIntervalo(null, d)).toBe(-1);
  });
  it('marcas bonitas', () => {
    expect(marcasBonitas(0, 10)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(marcasBonitas(3, 3)).toEqual([3]);
  });
  it('regressão: min e max quase iguais (contraexemplo do fast-check), largura indefinida', () => {
    // Antes: limpar() (12 dígitos) colapsava início e limites em 9999.99999999 > min, e os dois valores davam índice -1.
    const v = [9999.999999985, 9999.999999989002];
    const d = definirIntervalos(v, { largura: undefined });
    expect(d.quantidade).toBeGreaterThanOrEqual(1);
    expect(d.inicio).toBeLessThanOrEqual(v[0]!);
    expect(d.limites.at(-1)!).toBeGreaterThanOrEqual(v[1]!);
    const idx = atribuirIntervalos(v, d);
    expect(idx.every((i) => i >= 0 && i < d.quantidade)).toBe(true);
  });
  it('regressão: amplitude de poucos ulps e valores subnormais não geram largura 0 nem quantidade NaN', () => {
    for (const v of [[0, 1e-323], [5e-324, 1e-323, 0], [1000 - 2.2737367544323206e-13, 1000], [-1000, -1000 + 1.1368683772161603e-13]]) {
      const d = definirIntervalos(v);
      expect(d.largura).toBeGreaterThan(0);
      expect(Number.isInteger(d.quantidade) && d.quantidade >= 1 && d.quantidade <= 2000).toBe(true);
      expect(atribuirIntervalos(v, d).every((i) => i >= 0 && i < d.quantidade)).toBe(true);
    }
  });
  it('regressão: marcasBonitas com amplitude de ~1 ulp termina e é limitada (antes: laço até RangeError, minutos)', () => {
    const t0 = performance.now();
    const m = marcasBonitas(1000 - 2.2737367544323206e-13, 1000);
    expect(m.length).toBeLessThanOrEqual(MAX_MARCAS);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(marcasBonitas(0, 10)).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it('propriedade: todo valor válido cai em [0, quantidade) e contagens somam o total', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e4, max: 1e4, noNaN: true }), { minLength: 1, maxLength: 200 }),
        fc.option(fc.double({ min: 0.01, max: 500, noNaN: true }), { nil: undefined }),
        (v, largura) => {
          const d = definirIntervalos(v, { largura });
          const idx = atribuirIntervalos(v, d);
          expect(idx.every((i) => i >= 0 && i < d.quantidade)).toBe(true);
          const cont = new Array(d.quantidade).fill(0);
          idx.forEach((i) => cont[i]++);
          expect(cont.reduce((a, b) => a + b, 0)).toBe(v.length);
        },
      ),
      rodadas(100),
    );
  });
});
