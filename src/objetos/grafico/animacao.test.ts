import { describe, expect, it } from 'vitest';
import {
  deveAnimar, emMovimento, facilidade, limitarDuracao, LIMITE_PONTOS_ANIMADOS, origemParaNovaLista, passoAnimacao, progresso,
} from './animacao';

describe('animação: funções puras', () => {
  it('facilidade vai de 0 a 1, é crescente e desacelera', () => {
    expect(facilidade(0)).toBe(0);
    expect(facilidade(1)).toBe(1);
    expect(facilidade(-5)).toBe(0);
    expect(facilidade(7)).toBe(1);
    let ant = 0;
    for (let i = 1; i <= 10; i++) {
      const v = facilidade(i / 10);
      expect(v).toBeGreaterThan(ant);
      ant = v;
    }
    expect(facilidade(0.5)).toBeGreaterThan(0.5);
  });

  it('progresso e duração', () => {
    expect(progresso(250, 500)).toBe(0.5);
    expect(progresso(900, 500)).toBe(1);
    expect(progresso(10, 0)).toBe(1);
    expect(limitarDuracao(100)).toBe(400);
    expect(limitarDuracao(5000)).toBe(600);
    expect(limitarDuracao(500)).toBe(500);
  });

  it('converge: passos sucessivos aproximam e o último é exatamente o alvo', () => {
    const origem = new Float32Array([0, 0, 100, 100, 5, 5]);
    const alvo = new Float32Array([50, 80, 100, 0, 5, 5.5]);
    const atual = new Float32Array(6);
    let distAnterior = Infinity;
    let terminou = false;
    for (let i = 0; i <= 10 && !terminou; i++) {
      terminou = passoAnimacao(origem, alvo, atual, i / 10);
      let dist = 0;
      for (let i = 0; i < 6; i++) dist += Math.abs(atual[i]! - alvo[i]!);
      expect(dist).toBeLessThanOrEqual(distAnterior + 1e-6);
      distAnterior = dist;
    }
    expect(terminou).toBe(true);
    expect(Array.from(atual)).toEqual(Array.from(alvo));
    expect(emMovimento(atual, alvo)).toBe(false);
  });

  it('em t=0 fica na origem e ainda está em movimento', () => {
    const origem = new Float32Array([0, 0]);
    const alvo = new Float32Array([10, 10]);
    const atual = new Float32Array(2);
    expect(passoAnimacao(origem, alvo, atual, 0)).toBe(false);
    expect(Array.from(atual)).toEqual([0, 0]);
    expect(emMovimento(atual, alvo)).toBe(true);
  });

  it('simula um laço por tempo: termina em ~500 ms', () => {
    const origem = new Float32Array([0, 0]);
    const alvo = new Float32Array([300, 200]);
    const atual = new Float32Array(2);
    let t = 0;
    let quadros = 0;
    while (!passoAnimacao(origem, alvo, atual, progresso(t, 500))) {
      t += 16;
      quadros++;
      expect(quadros).toBeLessThan(100);
    }
    expect(t).toBeGreaterThanOrEqual(500);
    expect(t).toBeLessThan(520);
  });

  it('não interpola acima do limite nem com movimento reduzido', () => {
    expect(deveAnimar(100, false)).toBe(true);
    expect(deveAnimar(100, true)).toBe(false);
    expect(deveAnimar(LIMITE_PONTOS_ANIMADOS, false)).toBe(true);
    expect(deveAnimar(LIMITE_PONTOS_ANIMADOS + 1, false)).toBe(false);
  });

  it('origemParaNovaLista mantém posição atual e usa padrão para casos novos', () => {
    const o = origemParaNovaLista(['a', 'b'], new Float32Array([1, 2, 3, 4]), ['b', 'c', 'a'], new Float32Array([9, 9, 8, 8, 7, 7]));
    expect(Array.from(o)).toEqual([3, 4, 8, 8, 1, 2]);
  });
});
