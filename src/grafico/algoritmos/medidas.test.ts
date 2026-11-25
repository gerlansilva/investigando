import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  amplitude, contarPorGrupo, maximo, media, mediana, minimo, modas, porcentagem, proporcao, resumir, tabelaCruzada, valoresVisiveis,
} from './medidas';

describe('medidas', () => {
  it('vazio e só nulos devolvem null/[]', () => {
    const r = resumir([null, null]);
    expect(r).toEqual({ n: 0, media: null, mediana: null, modas: [], minimo: null, maximo: null, amplitude: null });
    expect(resumir([]).n).toBe(0);
  });
  it('um ponto', () => {
    expect(resumir([4])).toEqual({ n: 1, media: 4, mediana: 4, modas: [4], minimo: 4, maximo: 4, amplitude: 0 });
  });
  it('valores iguais', () => {
    const r = resumir([3, 3, 3]);
    expect(r.modas).toEqual([3]);
    expect(r.amplitude).toBe(0);
  });
  it('média, mediana par/ímpar, mín, máx, amplitude', () => {
    expect(media([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(mediana([5, 1, 3])).toBe(3);
    expect(minimo([5, null, 1])).toBe(1);
    expect(maximo([5, null, 1])).toBe(5);
    expect(amplitude([5, null, 1])).toBe(4);
  });
  it('todas as modas em caso de empate; amodal quando todos distintos', () => {
    expect(modas([1, 1, 2, 2, 3])).toEqual([1, 2]);
    expect(modas([1, 2, 3])).toEqual([]);
  });
  it('ignora nulos e casos ocultos', () => {
    expect(valoresVisiveis([1, null, 3, 99], [false, false, false, true])).toEqual([1, 3]);
    expect(resumir([1, null, 3, 99], [false, false, false, true]).media).toBe(2);
  });
  it('proporção e porcentagem com total 0', () => {
    expect(proporcao(1, 4)).toBe(0.25);
    expect(porcentagem(1, 4)).toBe(25);
    expect(porcentagem(0, 0)).toBe(0);
  });
  it('contagem por grupo inclui "(sem valor)", categoria única, ordem escolhida', () => {
    const c = contarPorGrupo(['b', 'a', null, 'b'], ['a', 'b']);
    expect(c.grupos).toEqual(['a', 'b', '(sem valor)']);
    expect(c.contagens).toEqual([1, 2, 1]);
    expect(c.porcentagens).toEqual([25, 50, 25]);
    expect(contarPorGrupo(['x']).contagens).toEqual([1]);
    expect(contarPorGrupo([]).total).toBe(0);
  });
  it('tabela cruzada: total, linha e coluna', () => {
    const t = tabelaCruzada(['m', 'm', 'f', 'f', 'f'], ['s', 'n', 's', 's', 'n']);
    expect(t.contagem).toEqual([[1, 1], [2, 1]]);
    expect(t.totalLinha).toEqual([2, 3]);
    expect(t.totalColuna).toEqual([3, 2]);
    expect(t.pctTotal[1]![0]).toBe(40);
    expect(t.pctLinha[0]).toEqual([50, 50]);
    expect(t.pctColuna[0]![0]).toBeCloseTo(100 / 3, 9);
    expect(t.pctColuna[1]![0]).toBeCloseTo(200 / 3, 9);
  });
  it('propriedade: contagens somam o total (grupos e tabela cruzada)', () => {
    const cat = fc.option(fc.constantFrom('a', 'b', 'c', 'd'), { nil: null });
    fc.assert(
      fc.property(fc.array(fc.tuple(cat, cat), { maxLength: 300 }), (pares) => {
        const a = pares.map((p) => p[0]);
        const b = pares.map((p) => p[1]);
        const c = contarPorGrupo(a);
        expect(c.contagens.reduce((x, y) => x + y, 0)).toBe(pares.length);
        const t = tabelaCruzada(a, b);
        expect(t.contagem.flat().reduce((x, y) => x + y, 0)).toBe(pares.length);
        expect(t.totalLinha.reduce((x, y) => x + y, 0)).toBe(pares.length);
        expect(t.totalColuna.reduce((x, y) => x + y, 0)).toBe(pares.length);
      }),
    );
  });
  it('propriedade: mín ≤ média ≤ máx', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 100 }), (v) => {
        const m = media(v)!;
        expect(m).toBeGreaterThanOrEqual(minimo(v)! - 1e-6);
        expect(m).toBeLessThanOrEqual(maximo(v)! + 1e-6);
      }),
    );
  });
});
