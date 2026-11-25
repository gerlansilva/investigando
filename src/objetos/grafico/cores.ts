// Cores dos pontos por atributo: paleta categórica acessível e gradiente numérico (sem DOM).
import type { Atributo, Caso, Colecao } from '../../modelo/tipos';
import { agruparCategorias } from '../../grafico/algoritmos/separar';
import { formatarNumero } from '../../grafico/algoritmos/intervalos';
import { textos } from './textos';
import { ordemDeDatas, valorNumerico } from './dadosEixo';

export const COR_PADRAO = '#2a6fdb';
export const COR_SEM_VALOR = '#8f8f8f';

/** Paleta de Okabe e Ito (distinguível por daltônicos), sem o preto; o amarelo foi escurecido (#99950A, 3,15:1 sobre branco, ΔE Lab >= 29 dos demais). */
export const PALETA_CATEGORICA: readonly string[] = [
  '#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#99950A', '#7a5c00',
];

/** Paradas do gradiente numérico (do menor ao maior; sequencial, boa leitura em tons de cinza). */
export const PARADAS_GRADIENTE: readonly string[] = ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'];

export type Legenda =
  | { tipo: 'categorica'; titulo: string; itens: { rotulo: string; cor: string }[] }
  | { tipo: 'gradiente'; titulo: string; minimo: number; maximo: number; rotuloMinimo: string; rotuloMaximo: string; paradas: string[]; temSemValor: boolean };

export function corDaCategoria(i: number): string {
  if (i < PALETA_CATEGORICA.length) return PALETA_CATEGORICA[i]!;
  const matiz = (i * 137.508) % 360;
  const luz = 38 + ((i * 7) % 3) * 10;
  return `hsl(${matiz.toFixed(0)} 62% ${luz}%)`;
}

function hexParaRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Cor do gradiente para t em [0, 1]. */
export function corDoGradiente(t: number, paradas: readonly string[] = PARADAS_GRADIENTE): string {
  const c = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const pos = c * (paradas.length - 1);
  const i = Math.min(paradas.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = hexParaRgb(paradas[i]!);
  const b = hexParaRgb(paradas[i + 1]!);
  const m = (k: number) => Math.round(a[k]! + (b[k]! - a[k]!) * f);
  return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
}

export interface ResultadoCores {
  /** Uma cor por caso (na ordem de `casos`). */
  cores: string[];
  legenda: Legenda | null;
}

export function calcularCores(colecao: Colecao | undefined, casos: readonly Caso[], atributoId: string | undefined): ResultadoCores {
  const atributo: Atributo | undefined = atributoId ? colecao?.atributos.find((a) => a.id === atributoId) : undefined;
  if (!atributo) return { cores: casos.map(() => COR_PADRAO), legenda: null };

  if (atributo.tipo === 'numerico') {
    const valores = casos.map((c) => valorNumerico(c.valores[atributo.id]));
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of valores) {
      if (v === null) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const temValor = lo <= hi;
    const amp = hi - lo;
    const cores = valores.map((v) => (v === null ? COR_SEM_VALOR : corDoGradiente(amp > 0 ? (v - lo) / amp : 0.5)));
    if (!temValor) return { cores, legenda: null };
    return {
      cores,
      legenda: {
        tipo: 'gradiente',
        titulo: atributo.nome,
        minimo: lo,
        maximo: hi,
        rotuloMinimo: formatarNumero(lo, true),
        rotuloMaximo: formatarNumero(hi, true),
        paradas: [...PARADAS_GRADIENTE],
        temSemValor: valores.some((v) => v === null),
      },
    };
  }

  const ordem = atributo.tipo === 'data' ? ordemDeDatas(casos, atributo.id) : undefined;
  const ag = agruparCategorias(casos.map((c) => c.valores[atributo.id] ?? null), ordem);
  const corDe = (i: number) => (ag.categorias[i] === textos.semValor ? COR_SEM_VALOR : corDaCategoria(i));
  const cores = ag.indice.map(corDe);
  return {
    cores,
    legenda: { tipo: 'categorica', titulo: atributo.nome, itens: ag.categorias.map((rotulo, i) => ({ rotulo, cor: corDe(i) })) },
  };
}
