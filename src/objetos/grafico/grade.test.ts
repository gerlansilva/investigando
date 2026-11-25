import { describe, expect, it } from 'vitest';
import { acharEmRetangulo, acharPonto, construirGrade } from './grade';

const pos = (...p: number[]) => new Float32Array(p);

describe('grade espacial', () => {
  it('acha o ponto sob o clique e ignora cliques longe', () => {
    const g = construirGrade(pos(10, 10, 100, 100, 300, 50), 3, 400, 200);
    expect(acharPonto(g, 12, 9, 6)).toBe(0);
    expect(acharPonto(g, 100, 105, 6)).toBe(1);
    expect(acharPonto(g, 300, 50, 6)).toBe(2);
    expect(acharPonto(g, 200, 150, 6)).toBe(-1);
  });

  it('sobreposição: vence o último desenhado', () => {
    const g = construirGrade(pos(50, 50, 52, 50), 2, 100, 100);
    expect(acharPonto(g, 51, 50, 6)).toBe(1);
  });

  it('acha ponto cruzando a fronteira de células', () => {
    const g = construirGrade(pos(23.5, 23.5), 1, 100, 100, 24);
    expect(acharPonto(g, 26, 26, 6)).toBe(0);
  });

  it('retângulo (qualquer direção de arraste, bordas inclusive)', () => {
    const g = construirGrade(pos(10, 10, 100, 100, 300, 50, 50, 150), 4, 400, 200);
    expect(acharEmRetangulo(g, 0, 0, 120, 120)).toEqual([0, 1]);
    expect(acharEmRetangulo(g, 120, 120, 0, 0)).toEqual([0, 1]);
    expect(acharEmRetangulo(g, 10, 10, 10, 10)).toEqual([0]);
    expect(acharEmRetangulo(g, 0, 0, 400, 200)).toEqual([0, 1, 2, 3]);
    expect(acharEmRetangulo(g, 200, 0, 250, 20)).toEqual([]);
  });

  it('vazio e pontos fora da área não quebram', () => {
    const g = construirGrade(new Float32Array(0), 0, 100, 100);
    expect(acharPonto(g, 5, 5, 5)).toBe(-1);
    expect(acharEmRetangulo(g, 0, 0, 100, 100)).toEqual([]);
    const h = construirGrade(pos(-5, 500), 1, 100, 100);
    expect(acharEmRetangulo(h, -10, 400, 10, 600)).toEqual([]);
  });
});
