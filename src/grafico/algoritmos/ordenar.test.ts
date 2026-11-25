import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ordenar } from './ordenar';

describe('ordenar', () => {
  it('vazio', () => {
    const r = ordenar([], { inicio: 0, fim: 100 });
    expect(r.posicoes).toEqual([]);
    expect(r.ordem).toEqual([]);
  });
  it('um ponto fica no meio', () => {
    expect(ordenar([5], { inicio: 10, fim: 110 }).posicoes).toEqual([60]);
  });
  it('espaçamento igual', () => {
    const r = ordenar([30, 10, 20], { inicio: 0, fim: 100 });
    expect(r.posicoes).toEqual([100, 0, 50]);
    expect(r.ordem).toEqual([1, 2, 0]);
  });
  it('proporcional ao valor', () => {
    const r = ordenar([0, 1, 10], { inicio: 0, fim: 100, modo: 'proporcional' });
    expect(r.posicoes).toEqual([0, 10, 100]);
  });
  it('proporcional com domínio explícito', () => {
    const r = ordenar([5], { inicio: 0, fim: 100, modo: 'proporcional', dominio: [0, 10] });
    expect(r.posicoes).toEqual([50]);
  });
  it('valores iguais: desempate estável (ordem original)', () => {
    const r = ordenar([2, 2, 2], { inicio: 0, fim: 100 });
    expect(r.posto).toEqual([0, 1, 2]);
    expect(r.posicoes).toEqual([0, 50, 100]);
  });
  it('valores iguais no modo proporcional ficam na mesma posição', () => {
    const r = ordenar([4, 4], { inicio: 0, fim: 100, modo: 'proporcional' });
    expect(r.posicoes).toEqual([50, 50]);
  });
  it('nulos ficam sem posição e por último na ordem', () => {
    const r = ordenar([null, 3, 1], { inicio: 0, fim: 10 });
    expect(r.posicoes[0]).toBeNull();
    expect(r.ordem).toEqual([2, 1, 0]);
  });
  it('decrescente mantém estabilidade', () => {
    const r = ordenar([1, 2, 2], { inicio: 0, fim: 10, decrescente: true });
    expect(r.ordem).toEqual([1, 2, 0]);
  });
  it('textos em ordem do português', () => {
    const r = ordenar(['é', 'z', 'a'], { inicio: 0, fim: 10 });
    expect(r.ordem).toEqual([2, 0, 1]);
  });
  it('propriedade: posições dentro de [início, fim] e monotônicas com o valor', () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.integer({ min: -50, max: 50 }), { nil: null }), { maxLength: 100 }),
        fc.boolean(),
        (v, prop) => {
          const r = ordenar(v, { inicio: 5, fim: 95, modo: prop ? 'proporcional' : 'igual' });
          const par: [number, number][] = [];
          v.forEach((x, i) => {
            const p = r.posicoes[i];
            if (x === null) expect(p).toBeNull();
            else {
              expect(p!).toBeGreaterThanOrEqual(5 - 1e-9);
              expect(p!).toBeLessThanOrEqual(95 + 1e-9);
              par.push([x, p!]);
            }
          });
          par.sort((a, b) => a[0] - b[0]);
          for (let i = 1; i < par.length; i++) expect(par[i]![1]).toBeGreaterThanOrEqual(par[i - 1]![1] - 1e-9);
        },
      ),
    );
  });
});
