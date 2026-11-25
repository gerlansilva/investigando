// Tipos próprios dos algoritmos do gráfico. Puros: sem React, Tauri, DOM nem imports de modelo/estado.

export type Valor = number | string | null;

/** Rótulo visível para casos sem valor (nulo) no atributo do eixo. */
export const ROTULO_SEM_VALOR = '(sem valor)';

export interface Ponto {
  id: string;
  x: number;
  y: number;
}

/** Trecho [ini, fim] de um eixo, em pixels. */
export interface Faixa {
  ini: number;
  fim: number;
}

/** Retorna o número se for finito; caso contrário, null. */
export function numeroOuNulo(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Arredonda ruído de ponto flutuante (12 dígitos significativos). */
export function limpar(n: number): number {
  if (!Number.isFinite(n)) return n;
  const r = Number(n.toPrecision(12));
  return Object.is(r, -0) ? 0 : r;
}

/** Se q está a menos de 1e-9 de um inteiro, devolve o inteiro. */
export function encaixarInteiro(q: number): number {
  const r = Math.round(q);
  return Math.abs(q - r) < 1e-9 ? r : q;
}
