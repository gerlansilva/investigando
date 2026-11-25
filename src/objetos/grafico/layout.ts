// Cálculo do layout do gráfico: casos visíveis, posições-alvo (ou nuvem) e metadados dos eixos. Sem DOM.
import type { Caso, Colecao } from '../../modelo/tipos';
import {
  calcularPosicoes, posicoesIniciais, EIXO_NENHUM, type ResultadoPosicoes,
} from '../../grafico/algoritmos/posicoes';
import { agruparCategorias } from '../../grafico/algoritmos/separar';
import { resolverEixo, type EixoResolvido } from './dadosEixo';
import type { EstadoGrafico } from './estado';
import { aplicarFiltro } from './filtro';

export interface Margem {
  esq: number;
  dir: number;
  sup: number;
  inf: number;
}

export const LARGURA_CARACTERE = 6.6;
export const TAMANHO_MINIMO_AREA = 60;

function maiorRotuloCategoria(estado: EstadoGrafico, colecao: Colecao | undefined): number {
  const eixo = estado.y;
  const atributo = eixo && colecao?.atributos.find((a) => a.id === eixo.atributoId);
  if (!eixo || !atributo || !colecao) return 0;
  const ag = agruparCategorias(colecao.casos.map((c) => c.valores[atributo.id] ?? null));
  return Math.min(18, Math.max(3, ...ag.categorias.map((c) => c.length)));
}

/** Margens ao redor da área dos pontos, para os rótulos dos eixos. */
export function calcularMargem(estado: EstadoGrafico, colecao: Colecao | undefined): Margem {
  const ay = estado.y && colecao?.atributos.find((a) => a.id === estado.y!.atributoId);
  const ax = estado.x && colecao?.atributos.find((a) => a.id === estado.x!.atributoId);
  let esq = 16;
  if (ay && estado.y) {
    if (ay.tipo === 'numerico' && estado.y.modo !== 'intervalos') esq = 64;
    else if (ay.tipo === 'numerico') esq = 34 + 12 * LARGURA_CARACTERE;
    else esq = Math.min(170, 36 + maiorRotuloCategoria(estado, colecao) * LARGURA_CARACTERE);
  }
  let inf = 14;
  if (ax && estado.x) inf = ax.tipo === 'numerico' && estado.x.modo === 'intervalos' ? 68 : 50;
  return { esq: Math.round(esq), dir: 20, sup: 12, inf };
}

export function areaInterna(larguraTotal: number, alturaTotal: number, m: Margem): { largura: number; altura: number } {
  return {
    largura: Math.max(TAMANHO_MINIMO_AREA, Math.floor(larguraTotal - m.esq - m.dir)),
    altura: Math.max(TAMANHO_MINIMO_AREA, Math.floor(alturaTotal - m.sup - m.inf)),
  };
}

/**
 * Nuvem aleatória reproduzível ([x0, y0, ...] na ordem de `ids`). Calculada para todos os casos da
 * coleção, assim filtrar não embaralha os que ficam.
 */
export function calcularNuvem(
  colecao: Colecao | undefined,
  ids: readonly string[],
  largura: number,
  altura: number,
  semente: number,
  diametro: number,
): Float32Array {
  const todos = posicoesIniciais(colecao?.casos.map((c) => c.id) ?? [], largura, altura, semente, diametro);
  const mapa = new Map(todos.map((p) => [p.id, p]));
  const saida = new Float32Array(ids.length * 2);
  ids.forEach((id, i) => {
    const p = mapa.get(id);
    saida[2 * i] = p?.x ?? largura / 2;
    saida[2 * i + 1] = p?.y ?? altura / 2;
  });
  return saida;
}

export interface Layout {
  casos: Caso[];
  ids: string[];
  x: EixoResolvido;
  y: EixoResolvido;
  resultado: ResultadoPosicoes;
  /** Posições-alvo [x0, y0, x1, y1, ...] na ordem de `casos`. */
  alvo: Float32Array;
  /** Diâmetro com que os pontos devem ser desenhados (pode ser menor que o pedido). */
  diametro: number;
  /** Sem nenhum eixo: os pontos ficam na nuvem aleatória. */
  nuvem: boolean;
  erroFiltro: string | null;
  filtrando: boolean;
  totalCasos: number;
  largura: number;
  altura: number;
}

export interface EntradaLayout {
  estado: EstadoGrafico;
  colecao: Colecao | undefined;
  /** Tamanho da área interna dos pontos, em pixels. */
  largura: number;
  altura: number;
  globais?: Record<string, number>;
}

export function prepararLayout(e: EntradaLayout): Layout {
  const { estado, colecao, largura, altura } = e;
  const d = estado.icone.tamanho;
  const filtrado = colecao ? aplicarFiltro(colecao, estado.filtro, e.globais) : { casos: [], erro: null, filtrando: false };
  const casos = filtrado.casos;
  const ids = casos.map((c) => c.id);
  const atributos = colecao?.atributos ?? [];
  const x = resolverEixo(estado.x, atributos, casos);
  const y = resolverEixo(estado.y, atributos, casos);
  const nuvem = x.cfg.tipo === 'nenhum' && y.cfg.tipo === 'nenhum';
  const base = { largura, altura, diametro: d };
  const resultado = nuvem
    ? { ...calcularPosicoes({ ids: [], x: EIXO_NENHUM, y: EIXO_NENHUM, ...base }), diametroEfetivo: d, fatorIcone: 1 }
    : calcularPosicoes({ ids, x: x.cfg, y: y.cfg, ordemEmpilhamento: 'caso', ...base });
  const alvo = new Float32Array(ids.length * 2);
  if (nuvem) {
    alvo.set(calcularNuvem(colecao, ids, largura, altura, estado.semente, d));
  } else {
    resultado.pontos.forEach((p, i) => {
      alvo[2 * i] = p.x;
      alvo[2 * i + 1] = p.y;
    });
  }
  return {
    casos, ids, x, y, resultado, alvo,
    diametro: nuvem ? d : resultado.diametroEfetivo,
    nuvem,
    erroFiltro: filtrado.erro,
    filtrando: filtrado.filtrando,
    totalCasos: colecao?.casos.length ?? 0,
    largura, altura,
  };
}
