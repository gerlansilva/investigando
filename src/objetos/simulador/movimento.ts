/** true quando o sistema pede menos movimento (prefers-reduced-motion). */
export function prefereMenosMovimento(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function suavizarSaida(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}
