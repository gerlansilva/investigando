import type { Caso, Colecao } from '../modelo/tipos';

export type Valor = number | string | boolean | null;

export interface Contexto {
  caso: Caso;
  colecao: Colecao;
  globais: Record<string, number>;
  rng?: () => number;
  indice?: number;
}

export type Resultado = { ok: true; valor: Valor } | { ok: false; erro: import('./erro').ErroFormula };
