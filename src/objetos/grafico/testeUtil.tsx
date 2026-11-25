import { vi } from 'vitest';
import type { Colecao, ObjetoMesa } from '../../modelo/tipos';
import type { PropsObjeto } from '../../app/tiposObjeto';
import { estadoPadrao, type EstadoGrafico } from './estado';

export const ID_COL = 'col';
export const A_MEIO = 'meio';
export const A_TEMPO = 'tempo';
export const A_IDADE = 'idade';

/** 6 casos: 3 categorias (A, B, C) e valores numéricos pequenos. */
export function colecaoPequena(): Colecao {
  const dados: [string, number, number][] = [
    ['A', 0, 8], ['A', 2.5, 9], ['B', 5, 10], ['B', 7.5, 10], ['C', 10, 11], ['C', 10, 12],
  ];
  return {
    id: ID_COL,
    nome: 'Turma',
    atributos: [
      { id: A_MEIO, nome: 'Meio', tipo: 'categorico', cor: '#000' },
      { id: A_TEMPO, nome: 'Tempo', tipo: 'numerico', cor: '#000', unidade: 'min' },
      { id: A_IDADE, nome: 'Idade', tipo: 'numerico', cor: '#000' },
    ],
    casos: dados.map(([m, t, i], k) => ({ id: `c${k}`, valores: { [A_MEIO]: m, [A_TEMPO]: t, [A_IDADE]: i } })),
  };
}

export function objetoGrafico(estado: unknown, l = 948, a = 420): ObjetoMesa {
  return { id: 'g1', tipo: 'grafico', x: 0, y: 0, l, a, etapa: 'analise', estado };
}

export function estadoCom(parcial: Partial<EstadoGrafico>): EstadoGrafico {
  return { ...estadoPadrao(ID_COL, 5), ...parcial };
}

export function criarProps(estado: unknown, sobrescrever: Partial<PropsObjeto<unknown>> = {}): PropsObjeto<unknown> {
  return {
    objeto: objetoGrafico(estado),
    colecao: colecaoPequena(),
    selecao: new Set<string>(),
    aoSelecionar: vi.fn(),
    executar: vi.fn(),
    selarHistorico: vi.fn(),
    perfil: 'finais',
    ...sobrescrever,
  };
}

/** Contexto 2D simulado que registra chamadas (jsdom não implementa canvas). */
export function criarContextoSimulado() {
  const chamadas: { nome: string; args: unknown[] }[] = [];
  const alvo: Record<string, unknown> = {};
  const ctx = new Proxy(alvo, {
    get(t, nome: string) {
      if (nome in t) return t[nome];
      return (...args: unknown[]) => {
        chamadas.push({ nome, args });
      };
    },
    set(t, nome: string, v) {
      t[nome] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, chamadas };
}

export function simularCanvas() {
  const sim = criarContextoSimulado();
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => sim.ctx) as unknown as typeof original;
  return { ...sim, restaurar: () => { HTMLCanvasElement.prototype.getContext = original; } };
}

export function simularMovimentoReduzido(reduzido: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduzido && q.includes('reduce'),
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
