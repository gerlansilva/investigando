import { ROTULO_SEM_VALOR, numeroOuNulo } from './tipos';
import { valoresValidos } from './intervalos';

/** Mantém só os valores numéricos de casos visíveis (ignora nulos, NaN e casos ocultos). */
export function valoresVisiveis(
  valores: readonly (number | null | undefined)[],
  ocultos?: readonly (boolean | undefined)[],
): number[] {
  const saida: number[] = [];
  for (let i = 0; i < valores.length; i++) {
    if (ocultos?.[i]) continue;
    const n = numeroOuNulo(valores[i]);
    if (n !== null) saida.push(n);
  }
  return saida;
}

export interface Resumo {
  n: number;
  media: number | null;
  mediana: number | null;
  modas: number[];
  minimo: number | null;
  maximo: number | null;
  amplitude: number | null;
}

export function media(v: readonly (number | null | undefined)[]): number | null {
  const x = valoresValidos(v);
  if (x.length === 0) return null;
  // soma compensada (Kahan) para reduzir erro com muitos pontos
  let soma = 0;
  let c = 0;
  for (const y of x) {
    const t = y - c;
    const s = soma + t;
    c = s - soma - t;
    soma = s;
  }
  return soma / x.length;
}

export function mediana(v: readonly (number | null | undefined)[]): number | null {
  const x = valoresValidos(v).sort((a, b) => a - b);
  const n = x.length;
  if (n === 0) return null;
  const m = n >> 1;
  return n % 2 === 1 ? x[m]! : (x[m - 1]! + x[m]!) / 2;
}

/**
 * Todas as modas (em ordem crescente). Decisão: se todos os valores são distintos e há mais de um
 * caso, não há moda (lista vazia); com um único caso, a moda é ele.
 */
export function modas(v: readonly (number | null | undefined)[]): number[] {
  const x = valoresValidos(v);
  if (x.length === 0) return [];
  const freq = new Map<number, number>();
  let max = 0;
  for (const y of x) {
    const f = (freq.get(y) ?? 0) + 1;
    freq.set(y, f);
    if (f > max) max = f;
  }
  if (max === 1 && x.length > 1) return [];
  const saida: number[] = [];
  for (const [valor, f] of freq) if (f === max) saida.push(valor);
  return saida.sort((a, b) => a - b);
}

export function minimo(v: readonly (number | null | undefined)[]): number | null {
  const x = valoresValidos(v);
  if (x.length === 0) return null;
  let m = x[0]!;
  for (const y of x) if (y < m) m = y;
  return m;
}

export function maximo(v: readonly (number | null | undefined)[]): number | null {
  const x = valoresValidos(v);
  if (x.length === 0) return null;
  let m = x[0]!;
  for (const y of x) if (y > m) m = y;
  return m;
}

export function amplitude(v: readonly (number | null | undefined)[]): number | null {
  const a = minimo(v);
  const b = maximo(v);
  return a === null || b === null ? null : b - a;
}

export function resumir(
  valores: readonly (number | null | undefined)[],
  ocultos?: readonly (boolean | undefined)[],
): Resumo {
  const x = valoresVisiveis(valores, ocultos);
  return {
    n: x.length,
    media: media(x),
    mediana: mediana(x),
    modas: modas(x),
    minimo: minimo(x),
    maximo: maximo(x),
    amplitude: amplitude(x),
  };
}

/** Proporção parte/total em [0, 1]; total 0 devolve 0. */
export function proporcao(parte: number, total: number): number {
  return total === 0 ? 0 : parte / total;
}

/** Porcentagem parte/total em [0, 100]; total 0 devolve 0. */
export function porcentagem(parte: number, total: number): number {
  return proporcao(parte, total) * 100;
}

export interface ContagemGrupos {
  grupos: string[];
  contagens: number[];
  total: number;
  proporcoes: number[];
  porcentagens: number[];
}

function rotulo(c: string | null | undefined): string {
  return c === null || c === undefined ? ROTULO_SEM_VALOR : c;
}

/** Ordem dos grupos: a informada, depois os demais por primeira aparição; "(sem valor)" por último. */
export function ordenarGrupos(rotulos: readonly string[], ordem?: readonly string[]): string[] {
  const presentes = new Set(rotulos);
  const saida: string[] = [];
  const vistos = new Set<string>();
  for (const o of ordem ?? []) {
    if (presentes.has(o) && !vistos.has(o)) {
      vistos.add(o);
      saida.push(o);
    }
  }
  let temNulo = false;
  for (const r of rotulos) {
    if (vistos.has(r)) continue;
    if (r === ROTULO_SEM_VALOR) {
      temNulo = true;
      continue;
    }
    vistos.add(r);
    saida.push(r);
  }
  if (temNulo && !vistos.has(ROTULO_SEM_VALOR)) saida.push(ROTULO_SEM_VALOR);
  return saida;
}

/** Contagem de casos por categoria; nulos entram em "(sem valor)", então as contagens somam o total. */
export function contarPorGrupo(
  categorias: readonly (string | null | undefined)[],
  ordem?: readonly string[],
): ContagemGrupos {
  const rot = categorias.map(rotulo);
  const grupos = ordenarGrupos(rot, ordem);
  const pos = new Map(grupos.map((g, i) => [g, i]));
  const contagens = grupos.map(() => 0);
  for (const r of rot) contagens[pos.get(r)!]!++;
  const total = rot.length;
  return {
    grupos,
    contagens,
    total,
    proporcoes: contagens.map((c) => proporcao(c, total)),
    porcentagens: contagens.map((c) => porcentagem(c, total)),
  };
}

export interface TabelaCruzada {
  linhas: string[];
  colunas: string[];
  contagem: number[][];
  totalLinha: number[];
  totalColuna: number[];
  total: number;
  /** Porcentagens (0 a 100) em relação ao total geral, à linha e à coluna. */
  pctTotal: number[][];
  pctLinha: number[][];
  pctColuna: number[][];
}

export function tabelaCruzada(
  linhas: readonly (string | null | undefined)[],
  colunas: readonly (string | null | undefined)[],
  ordemLinhas?: readonly string[],
  ordemColunas?: readonly string[],
): TabelaCruzada {
  const n = Math.min(linhas.length, colunas.length);
  const rl = linhas.slice(0, n).map(rotulo);
  const rc = colunas.slice(0, n).map(rotulo);
  const gl = ordenarGrupos(rl, ordemLinhas);
  const gc = ordenarGrupos(rc, ordemColunas);
  const pl = new Map(gl.map((g, i) => [g, i]));
  const pc = new Map(gc.map((g, i) => [g, i]));
  const contagem = gl.map(() => gc.map(() => 0));
  for (let i = 0; i < n; i++) contagem[pl.get(rl[i]!)!]![pc.get(rc[i]!)!]!++;
  const totalLinha = contagem.map((l) => l.reduce((a, b) => a + b, 0));
  const totalColuna = gc.map((_, j) => contagem.reduce((a, l) => a + l[j]!, 0));
  return {
    linhas: gl,
    colunas: gc,
    contagem,
    totalLinha,
    totalColuna,
    total: n,
    pctTotal: contagem.map((l) => l.map((c) => porcentagem(c, n))),
    pctLinha: contagem.map((l, i) => l.map((c) => porcentagem(c, totalLinha[i]!))),
    pctColuna: contagem.map((l) => l.map((c, j) => porcentagem(c, totalColuna[j]!))),
  };
}
