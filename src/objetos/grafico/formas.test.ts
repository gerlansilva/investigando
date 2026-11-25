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

import { calcularFormas, FORMAS_DAS_CATEGORIAS } from './formasPorCategoria';
import { definirFormaPor, estadoPadrao } from './estado';
import { criarAtributo, criarCaso, criarColecao } from '../../modelo/fabrica';

describe('ícone por categoria', () => {
  const classe = criarAtributo({ nome: 'Classe', tipo: 'categorico' });
  const colecao = criarColecao('Z', [classe], ['Peixe', 'Ave', 'Peixe', 'Réptil'].map((v) => criarCaso({ [classe.id]: v })));
  it('dá a mesma forma a valores iguais e formas diferentes a valores diferentes', () => {
    const r = calcularFormas(colecao, colecao.casos, classe.id);
    expect(r.formas![0]).toBe(r.formas![2]);
    expect(new Set(r.formas).size).toBe(3);
    expect(r.legenda!.itens.map((i) => i.rotulo)).toEqual(['Peixe', 'Ave', 'Réptil']);
    expect(r.formas![0]).toBe('peixe'); // "Peixe" ganha o ícone de peixe
    expect(r.formas![1]).toBe('passaro'); // "Ave" ganha o de ave
    expect(FORMAS_DAS_CATEGORIAS).toContain(r.formas![3]!);
  });
  it('sem atributo não há formas por caso', () => {
    expect(calcularFormas(colecao, colecao.casos, undefined)).toEqual({ formas: null, legenda: null });
  });
  it('definirFormaPor liga e desliga sem perder a forma e o tamanho', () => {
    const e = definirFormaPor(estadoPadrao('c', 1), 'a');
    expect(e.icone.formaPor).toBe('a');
    expect(definirFormaPor(e, undefined).icone).toEqual(estadoPadrao('c', 1).icone);
  });
});
