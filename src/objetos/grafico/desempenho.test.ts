import { describe, expect, it } from 'vitest';
import type { Colecao } from '../../modelo/tipos';
import { passoAnimacao, origemParaNovaLista } from './animacao';
import { construirCena } from './cena';
import { construirGrade, acharPonto, acharEmRetangulo } from './grade';
import { calcularMargem, prepararLayout } from './layout';
import { estadoCom } from './testeUtil';

const N = 6000;
// Limites folgados (a máquina de CI pode ser lenta); o tempo real medido é impresso.
const LIMITE_POSICOES_MS = 1000;
const LIMITE_PASSO_MS = 100;

function colecaoGrande(n: number): Colecao {
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  return {
    id: 'col', nome: 'grande',
    atributos: [
      { id: 'cat', nome: 'Grupo', tipo: 'categorico', cor: '#000' },
      { id: 'a', nome: 'A', tipo: 'numerico', cor: '#000' },
      { id: 'b', nome: 'B', tipo: 'numerico', cor: '#000' },
    ],
    casos: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      valores: { cat: ['x', 'y', 'z', 'w'][Math.floor(rnd() * 4)]!, a: Math.round(rnd() * 1000) / 10, b: Math.round(rnd() * 500) / 10 },
    })),
  };
}

function medir<T>(f: () => T, repeticoes = 5): { resultado: T; ms: number } {
  let melhor = Infinity;
  let resultado!: T;
  for (let i = 0; i < repeticoes; i++) {
    const t0 = performance.now();
    resultado = f();
    melhor = Math.min(melhor, performance.now() - t0);
  }
  return { resultado, ms: melhor };
}

describe(`desempenho com ${N} pontos`, () => {
  const col = colecaoGrande(N);
  const configs = {
    'numérico × categórico (separar)': estadoCom({ x: { atributoId: 'a', modo: 'separar' }, y: { atributoId: 'cat', modo: 'separar' } }),
    'numérico empilhar': estadoCom({ x: { atributoId: 'a', modo: 'empilhar' } }),
    'intervalos × categórico': estadoCom({ x: { atributoId: 'a', modo: 'intervalos' }, y: { atributoId: 'cat', modo: 'separar' }, mostrar: ['media', 'contagem'] }),
    'dispersão numérico × numérico': estadoCom({ x: { atributoId: 'a', modo: 'separar' }, y: { atributoId: 'b', modo: 'separar' } }),
    'nuvem': estadoCom({}),
  };

  for (const [nome, estado] of Object.entries(configs)) {
    it(`calcula posições (${nome}) e a cena abaixo do limite`, () => {
      const { resultado: layout, ms } = medir(() => prepararLayout({ estado, colecao: col, largura: 900, altura: 500 }));
      const margem = calcularMargem(estado, col);
      const cena = medir(() => construirCena(layout, estado, margem));
      // eslint-disable-next-line no-console
      console.log(`[desempenho] ${nome}: prepararLayout(${N}) = ${ms.toFixed(1)} ms; construirCena = ${cena.ms.toFixed(1)} ms`);
      expect(layout.ids).toHaveLength(N);
      expect(layout.alvo).toHaveLength(2 * N);
      expect(ms).toBeLessThan(LIMITE_POSICOES_MS);
      expect(cena.ms).toBeLessThan(LIMITE_POSICOES_MS);
    });
  }

  it('um passo de animação e a troca de origem abaixo do limite; hit-test e laço rápidos', () => {
    const antes = prepararLayout({ estado: configs['nuvem'], colecao: col, largura: 900, altura: 500 });
    const depois = prepararLayout({ estado: configs['numérico × categórico (separar)'], colecao: col, largura: 900, altura: 500 });
    const atual = antes.alvo.slice();
    const passo = medir(() => passoAnimacao(antes.alvo, depois.alvo, atual, 0.5), 20);
    const troca = medir(() => origemParaNovaLista(antes.ids, antes.alvo, depois.ids, depois.alvo));
    const grade = medir(() => construirGrade(depois.alvo, N, 900, 500));
    const clique = medir(() => acharPonto(grade.resultado, 450, 250, 7), 50);
    const laco = medir(() => acharEmRetangulo(grade.resultado, 100, 100, 700, 400), 20);
    // eslint-disable-next-line no-console
    console.log(
      `[desempenho] passoAnimacao(${N}) = ${passo.ms.toFixed(3)} ms; origemParaNovaLista = ${troca.ms.toFixed(2)} ms; ` +
        `construirGrade = ${grade.ms.toFixed(2)} ms; acharPonto = ${clique.ms.toFixed(3)} ms; acharEmRetangulo = ${laco.ms.toFixed(2)} ms`,
    );
    expect(passo.ms).toBeLessThan(LIMITE_PASSO_MS);
    expect(troca.ms).toBeLessThan(LIMITE_PASSO_MS);
    expect(grade.ms).toBeLessThan(LIMITE_PASSO_MS);
    expect(clique.ms).toBeLessThan(LIMITE_PASSO_MS);
    expect(laco.ms).toBeLessThan(LIMITE_PASSO_MS);
  });
});
