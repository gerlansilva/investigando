import { encaixarInteiro, limpar, numeroOuNulo } from './tipos';

/** Limite de segurança para o número de intervalos de uma largura escolhida pelo usuário. */
export const MAX_INTERVALOS = 2000;

/** Limite de segurança para o número de marcas de eixo geradas por marcasBonitas. */
export const MAX_MARCAS = 1000;

export interface DefinicaoIntervalos {
  inicio: number;
  largura: number;
  quantidade: number;
  /** quantidade + 1 limites (vazio se não há valores). */
  limites: number[];
  rotulos: string[];
}

export interface OpcoesIntervalos {
  /** Largura escolhida pelo usuário; se ausente ou inválida, usa a regra de Sturges. */
  largura?: number;
  virgulaDecimal?: boolean;
  /** Casas decimais fixas nos rótulos (opcional). */
  casas?: number;
  /** Se verdadeiro (padrão), a largura de Sturges é arredondada para cima a 1, 2, 5 × 10^k. */
  arredondar?: boolean;
}

export function valoresValidos(valores: readonly (number | null | undefined)[]): number[] {
  const saida: number[] = [];
  for (const v of valores) {
    const n = numeroOuNulo(v);
    if (n !== null) saida.push(n);
  }
  return saida;
}

function minMax(v: readonly number[]): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const x of v) {
    if (x < mn) mn = x;
    if (x > mx) mx = x;
  }
  return [mn, mx];
}

/** Número de classes pela regra de Sturges: ceil(1 + log2 n). */
export function classesSturges(n: number): number {
  return n <= 0 ? 0 : Math.ceil(1 + Math.log2(n));
}

/** Menor valor "bonito" (1, 2, 5 × 10^k) maior ou igual a x. */
export function arredondarParaCima125(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const e = Math.floor(Math.log10(x));
  const base = Math.pow(10, e);
  // x subnormal: 10^e underflow para 0 (ou perde precisão); não há "bonito" representável, devolve x.
  if (!(base > 0) || !Number.isFinite(base) || x < 1e-300) return x;
  const m = x / base;
  const mult = m <= 1 + 1e-9 ? 1 : m <= 2 + 1e-9 ? 2 : m <= 5 + 1e-9 ? 5 : 10;
  return limpar(mult * base);
}

/** Largura bruta de Sturges: amplitude / ceil(1 + log2 n). Se amplitude 0 ou sem dados, 1. */
export function larguraSturges(valores: readonly (number | null | undefined)[], arredondar = true): number {
  const v = valoresValidos(valores);
  if (v.length === 0) return 1;
  const [mn, mx] = minMax(v);
  const amp = mx - mn;
  if (amp <= 0) return 1;
  const bruta = amp / classesSturges(v.length);
  return arredondar ? arredondarParaCima125(bruta) : bruta;
}

export function formatarNumero(n: number, virgula = false, casas?: number): string {
  let s = casas !== undefined ? n.toFixed(casas) : String(limpar(n));
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return virgula ? s.replace('.', ',') : s;
}

/** "[a; b[" ou, no último intervalo, "[a; b]". */
export function rotuloIntervalo(a: number, b: number, ultimo: boolean, virgula = false, casas?: number): string {
  return `[${formatarNumero(a, virgula, casas)}; ${formatarNumero(b, virgula, casas)}${ultimo ? ']' : '['}`;
}

/**
 * início = piso(min/largura) × largura; o último intervalo termina em início + quantidade × largura,
 * com quantidade = máx(1, teto((máx − início)/largura)).
 */
export function definirIntervalos(
  valores: readonly (number | null | undefined)[],
  opcoes: OpcoesIntervalos = {},
): DefinicaoIntervalos {
  const v = valoresValidos(valores);
  const larguraUsuario = opcoes.largura;
  const arredondar = opcoes.arredondar ?? true;
  const larguraValida = (w: number) => Number.isFinite(w) && w > 0;
  let largura =
    larguraUsuario !== undefined && larguraValida(larguraUsuario) ? larguraUsuario : larguraSturges(v, arredondar);
  if (v.length === 0) return { inicio: 0, largura: larguraValida(largura) ? largura : 1, quantidade: 0, limites: [], rotulos: [] };
  const [mn, mx] = minMax(v);
  // Proteção: largura do usuário que geraria intervalos demais volta à regra de Sturges.
  if ((mx - mn) / largura > MAX_INTERVALOS) largura = larguraSturges(v, arredondar);
  // Largura degenerada (subnormal que virou 0, amplitude abaixo da resolução do ponto flutuante, etc.): 1 intervalo largo.
  if (!larguraValida(largura) || (mx - mn) / largura > MAX_INTERVALOS) {
    largura = larguraValida((mx - mn) / MAX_INTERVALOS) && mx - mn > 0 ? Math.max((mx - mn) / classesSturges(v.length), (mx - mn) / MAX_INTERVALOS) : 1;
    if (!larguraValida(largura)) largura = 1;
  }
  let inicio = limpar(Math.floor(encaixarInteiro(mn / largura)) * largura);
  // A limpeza de ruído (12 dígitos) pode empurrar o início para cima do mínimo quando a largura é muito menor
  // que a magnitude dos valores: o início nunca pode ficar acima de min.
  if (!(inicio <= mn)) inicio = mn;
  let quantidade = Math.max(1, Math.ceil(encaixarInteiro((mx - inicio) / largura)));
  if (!Number.isFinite(quantidade) || quantidade > MAX_INTERVALOS) quantidade = MAX_INTERVALOS;
  const bruto: number[] = [];
  for (let i = 0; i <= quantidade; i++) bruto.push(inicio + i * largura);
  // Os limites cobrem [min, max] sempre; o último é prendido a max se o arredondamento ficar aquém.
  if (bruto[quantidade]! < mx) bruto[quantidade] = mx;
  // Limpar o ruído só vale se não destruir a ordem nem a cobertura de [min, max]
  // (com largura ≪ magnitude, 12 dígitos colapsariam limites vizinhos).
  const limpos = bruto.map(limpar);
  const limpoOk =
    limpos[0]! <= mn && limpos[quantidade]! >= mx && limpos.every((l, i) => i === 0 || l > limpos[i - 1]!);
  const limites = limpoOk ? limpos : bruto;
  inicio = limites[0]!;
  const rotulos: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    rotulos.push(rotuloIntervalo(limites[i]!, limites[i + 1]!, i === quantidade - 1, opcoes.virgulaDecimal, opcoes.casas));
  }
  return { inicio, largura, quantidade, limites, rotulos };
}

/**
 * índice = piso((v − início)/largura); o valor igual ao limite superior final cai no último intervalo
 * (fechado à direita). Fora da faixa devolve -1.
 */
export function indiceDoIntervalo(v: number | null | undefined, def: DefinicaoIntervalos): number {
  const n = numeroOuNulo(v);
  if (n === null || def.quantidade === 0) return -1;
  const ultimo = def.quantidade - 1;
  // Faixa coberta: comparada com os próprios limites (a mesma fonte dos rótulos), não com início + q × largura,
  // que perde precisão quando a largura é minúscula frente à magnitude dos valores.
  const lim = def.limites;
  if (lim.length === def.quantidade + 1 && (n < lim[0]! || n > lim[def.quantidade]!)) return -1;
  const q = encaixarInteiro((n - def.inicio) / def.largura);
  if (lim.length !== def.quantidade + 1 && (q < 0 || q > def.quantidade)) return -1;
  let i = Number.isFinite(q) ? Math.min(Math.max(Math.floor(q), 0), ultimo) : n < def.inicio ? 0 : ultimo;
  // Acerto fino pelos limites (o piso pode errar 1 por arredondamento); o último é fechado à direita.
  if (lim.length === def.quantidade + 1) {
    while (i > 0 && n < lim[i]!) i--;
    while (i < ultimo && n >= lim[i + 1]!) i++;
  }
  return i;
}

export function atribuirIntervalos(
  valores: readonly (number | null | undefined)[],
  def: DefinicaoIntervalos,
): number[] {
  return valores.map((v) => indiceDoIntervalo(v, def));
}

/** Marcas "bonitas" (passo 1, 2, 5 × 10^k) dentro de [lo, hi], cerca de `alvo` marcas. */
export function marcasBonitas(lo: number, hi: number, alvo = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) return [limpar(lo)];
  const passo = arredondarParaCima125((hi - lo) / Math.max(1, alvo));
  const k0 = Math.ceil(encaixarInteiro(lo / passo));
  const k1 = Math.floor((hi + passo * 1e-9) / passo);
  const total = k1 - k0 + 1;
  // Amplitude abaixo da resolução do ponto flutuante (k × passo deixa de crescer com k++) ou marcas demais:
  // devolve só os extremos em vez de laçar quase indefinidamente.
  if (!Number.isFinite(total) || Math.abs(k0) > 2 ** 52 || Math.abs(k1) > 2 ** 52 || total > MAX_MARCAS) {
    const a = limpar(lo);
    const b = limpar(hi);
    return a === b ? [a] : [a, b];
  }
  const marcas: number[] = [];
  for (let k = k0; k <= k1; k++) marcas.push(limpar(k * passo));
  return marcas;
}
