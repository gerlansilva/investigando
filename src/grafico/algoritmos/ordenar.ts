import { numeroOuNulo, type Valor } from './tipos';

const colador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Comparação: números antes de textos; textos pela ordem do português; nulos fora (tratados à parte). */
export function compararValores(a: Valor, b: Valor): number {
  const na = typeof a === 'number';
  const nb = typeof b === 'number';
  if (na && nb) return (a as number) - (b as number);
  if (na) return -1;
  if (nb) return 1;
  return colador.compare(String(a), String(b));
}

export interface OpcoesOrdenar {
  /** Posição do primeiro caso e do último (pixels). */
  inicio: number;
  fim: number;
  /** 'igual': espaçamento igual por posto; 'proporcional': proporcional ao valor (só numérico). */
  modo?: 'igual' | 'proporcional';
  decrescente?: boolean;
  /** Domínio explícito para o modo proporcional. */
  dominio?: readonly [number, number];
}

export interface ResultadoOrdenar {
  /** Posição por caso (mesma ordem da entrada); null para casos nulos. */
  posicoes: (number | null)[];
  /** Posto (0 = primeiro) por caso; null para nulos. */
  posto: (number | null)[];
  /** Índices dos casos na ordem final (nulos por último, na ordem original). */
  ordem: number[];
}

/** Ordenação estável: empates mantêm a ordem original dos casos. */
export function ordenar(valores: readonly Valor[], op: OpcoesOrdenar): ResultadoOrdenar {
  const validos: number[] = [];
  const nulos: number[] = [];
  valores.forEach((v, i) => {
    if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) nulos.push(i);
    else validos.push(i);
  });
  const sinal = op.decrescente ? -1 : 1;
  validos.sort((i, j) => sinal * compararValores(valores[i]!, valores[j]!) || i - j);
  const n = validos.length;
  const posicoes: (number | null)[] = valores.map(() => null);
  const posto: (number | null)[] = valores.map(() => null);

  let lo = 0;
  let hi = 0;
  const proporcional = op.modo === 'proporcional';
  if (proporcional) {
    const nums = validos.map((i) => numeroOuNulo(valores[i])).filter((x): x is number => x !== null);
    lo = op.dominio ? op.dominio[0] : nums.length ? Math.min(...nums) : 0;
    hi = op.dominio ? op.dominio[1] : nums.length ? Math.max(...nums) : 0;
  }
  validos.forEach((idx, r) => {
    posto[idx] = r;
    let pos: number;
    const meio = (op.inicio + op.fim) / 2;
    if (proporcional && typeof valores[idx] === 'number' && hi > lo) {
      let t = ((valores[idx] as number) - lo) / (hi - lo);
      if (op.decrescente) t = 1 - t;
      pos = op.inicio + Math.min(1, Math.max(0, t)) * (op.fim - op.inicio);
    } else if (proporcional) {
      pos = meio;
    } else {
      pos = n <= 1 ? meio : op.inicio + (r * (op.fim - op.inicio)) / (n - 1);
    }
    posicoes[idx] = pos;
  });
  return { posicoes, posto, ordem: [...validos, ...nulos] };
}
