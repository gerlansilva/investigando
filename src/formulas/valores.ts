import type { Valor } from './tipos';

export class ErroDeFuncao extends Error {}

export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function numeroDeTexto(texto: string): number | undefined {
  const t = texto.trim();
  if (!/^[+-]?\d+([.,]\d+)?$/.test(t)) return undefined;
  return Number(t.replace(',', '.'));
}

export function paraNumero(v: Valor): number | null {
  if (v === null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = numeroDeTexto(v);
  if (n === undefined) throw new ErroDeFuncao(`Não dá para fazer conta com o texto '${v}'`);
  return n;
}

export function tentarNumero(v: Valor): number | undefined {
  if (v === null) return undefined;
  if (typeof v === 'number') return Number.isNaN(v) ? undefined : v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return numeroDeTexto(v);
}

export function paraTexto(v: Valor): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'verdadeiro' : 'falso';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return v;
}

export function paraBooleano(v: Valor): boolean {
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return !['', 'falso', 'false', 'nao', 'não', '0'].includes(v.trim().toLowerCase());
}

export function paraValorDeCaso(v: Valor): number | string | null {
  if (v === null) return null;
  if (typeof v === 'boolean') return v ? 'verdadeiro' : 'falso';
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return v;
}
