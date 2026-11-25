import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { dispersarLateral, empilhar } from './empilhar';

describe('empilhar', () => {
  it('vazio e um ponto', () => {
    const v = empilhar([], { comprimento: 100, diametro: 10 });
    expect(v.posicoes).toEqual([]);
    expect(v.fatorIcone).toBe(1);
    const u = empilhar(['a'], { comprimento: 100, diametro: 10 });
    expect(u.posicoes[0]).toEqual({ desvio: 0, altura: 5 });
  });
  it('empilha a partir da base com passo = diâmetro quando cabe', () => {
    const r = empilhar([1, 1, 1], { comprimento: 100, diametro: 10 });
    expect(r.posicoes.map((p) => p.altura)).toEqual([5, 15, 25]);
    expect(r.colunas[0]!.passo).toBe(10);
  });
  it('colunas diferentes são independentes; categoria com um só caso', () => {
    const r = empilhar(['a', 'b', 'a'], { comprimento: 100, diametro: 10 });
    expect(r.posicoes.map((p) => p.altura)).toEqual([5, 5, 15]);
  });
  it('compacta o passo quando n × d > altura', () => {
    const r = empilhar(new Array(15).fill('a'), { comprimento: 100, diametro: 10 });
    expect(r.fatorIcone).toBe(1);
    expect(r.colunas[0]!.passo).toBeCloseTo(90 / 14, 9);
    expect(r.posicoes[14]!.altura).toBeCloseTo(95, 9);
  });
  it('último recurso: reduz o ícone', () => {
    const r = empilhar(new Array(100).fill('a'), { comprimento: 100, diametro: 10 });
    expect(r.fatorIcone).toBeLessThan(1);
    expect(r.passoMinimo).toBeCloseTo(0.5 * r.diametroEfetivo, 9);
    const topo = r.posicoes[99]!.altura + r.diametroEfetivo / 2;
    expect(topo).toBeLessThanOrEqual(100 + 1e-9);
  });
  it('margem nominal: com ícone reduzido, primeiro e último centro respeitam a margem e o passo mínimo vale', () => {
    const r = empilhar(new Array(5).fill('a'), { comprimento: 50, diametro: 17, margem: 8.5 });
    expect(r.fatorIcone).toBeLessThan(1);
    expect(r.posicoes[0]!.altura).toBeCloseTo(8.5, 9);
    expect(r.posicoes[4]!.altura).toBeCloseTo(50 - 8.5, 9);
    expect(r.posicoes[1]!.altura - r.posicoes[0]!.altura).toBeGreaterThanOrEqual(r.passoMinimo - 1e-9);
  });
  it('ordem dos casos x ordem por valor', () => {
    const chaves = ['a', 'a', 'a'];
    const vo = [30, 10, 20];
    const porValor = empilhar(chaves, { comprimento: 100, diametro: 10, valoresOrdem: vo });
    expect(porValor.posicoes.map((p) => p.altura)).toEqual([25, 5, 15]);
    const porCaso = empilhar(chaves, { comprimento: 100, diametro: 10, valoresOrdem: vo, ordem: 'caso' });
    expect(porCaso.posicoes.map((p) => p.altura)).toEqual([5, 15, 25]);
  });
  it('subcolunas quando a coluna é larga', () => {
    const r = empilhar(new Array(6).fill(0), { comprimento: 30, diametro: 10, larguraColuna: 30 });
    expect(r.colunas[0]!.subcolunas).toBe(2);
    expect(r.colunas[0]!.linhas).toBe(3);
    expect(r.posicoes.map((p) => p.desvio)).toEqual([-5, 5, -5, 5, -5, 5]);
    // cabendo na altura, a pilha fica numa só subcoluna
    expect(empilhar(new Array(6).fill(0), { comprimento: 100, diametro: 10, larguraColuna: 30 }).colunas[0]!.subcolunas).toBe(1);
  });
  it('chave nula é uma coluna própria', () => {
    expect(empilhar([null, 1, null], { comprimento: 100, diametro: 10 }).colunas).toHaveLength(2);
  });
  it('dispersão lateral centrada', () => {
    expect(dispersarLateral(['a', 'a', 'a', 'b'], 100, 10)).toEqual([-10, 0, 10, 0]);
  });
  it('propriedade: sem sobreposição além do permitido e dentro do comprimento', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 6 }), { maxLength: 300 }),
        fc.integer({ min: 20, max: 800 }),
        fc.integer({ min: 2, max: 30 }),
        fc.option(fc.integer({ min: 0, max: 120 }), { nil: undefined }),
        (chaves, L, d, larg) => {
          const r = empilhar(chaves, { comprimento: L, diametro: d, larguraColuna: larg });
          const de = r.diametroEfetivo;
          r.posicoes.forEach((p) => {
            expect(p.altura).toBeGreaterThanOrEqual(de / 2 - 1e-9);
            expect(p.altura).toBeLessThanOrEqual(L - de / 2 + 1e-9);
          });
          for (let i = 0; i < chaves.length; i++)
            for (let j = i + 1; j < chaves.length; j++) {
              if (chaves[i] !== chaves[j]) continue;
              const a = r.posicoes[i]!;
              const b = r.posicoes[j]!;
              const ok = Math.abs(a.desvio - b.desvio) >= de - 1e-9 || Math.abs(a.altura - b.altura) >= r.passoMinimo - 1e-9;
              expect(ok).toBe(true);
            }
        },
      ),
      { numRuns: 60 },
    );
  });
});
