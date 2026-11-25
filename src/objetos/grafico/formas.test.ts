import { describe, expect, it } from 'vitest';
import { caminhoSvg, CONTORNOS, FORMAS_ICONE } from './formas';

describe('formas dos pontos', () => {
  it('toda forma tem contornos finitos dentro da caixa de -1 a 1', () => {
    for (const f of FORMAS_ICONE) {
      expect(CONTORNOS[f].length).toBeGreaterThan(0);
      for (const c of CONTORNOS[f]) for (const [x, y] of c) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(1.1);
        expect(Math.abs(y)).toBeLessThanOrEqual(1.1);
      }
    }
  });
  it('gera caminho SVG para o painel', () => {
    for (const f of FORMAS_ICONE) expect(caminhoSvg(f)).toMatch(/^M[\d. L-]+Z/);
  });
});
