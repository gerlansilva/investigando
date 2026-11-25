// Estado do objeto gráfico (ver docs/CONTRATO-UI.md) e transformações puras sobre ele.
// Sem React nem DOM: cada função devolve um novo estado e nunca altera o recebido.
import { z } from 'zod';
import { FORMAS_ICONE, type FormaIcone } from './formas';

export type ModoEixo = 'separar' | 'ordenar' | 'empilhar' | 'intervalos';
export const MODOS_EIXO: readonly ModoEixo[] = ['separar', 'ordenar', 'empilhar', 'intervalos'];

/** Medidas desenhadas no gráfico. 'contagem' e 'porcentagem' são rótulos por grupo (extensão do contrato). */
export type Medida = 'media' | 'mediana' | 'moda' | 'contagem' | 'porcentagem';
export const MEDIDAS: readonly Medida[] = ['media', 'mediana', 'moda', 'contagem', 'porcentagem'];

export type { FormaIcone };
export type QualEixo = 'x' | 'y';

export interface EixoCfg {
  atributoId: string;
  modo: ModoEixo;
  intervalos?: { largura?: number };
}

export interface IconeCfg {
  forma: FormaIcone;
  tamanho: number;
}

export interface EstadoGrafico {
  colecaoId: string;
  x: EixoCfg | null;
  y: EixoCfg | null;
  corPor?: string;
  icone: IconeCfg;
  mostrar: Medida[];
  filtro?: string;
  semente: number;
}

export const TAMANHO_ICONE_MIN = 4;
export const TAMANHO_ICONE_MAX = 32;
export const TAMANHO_ICONE_PADRAO = 12;

const esquemaEixo = z.object({
  atributoId: z.string().min(1),
  modo: z.enum(['separar', 'ordenar', 'empilhar', 'intervalos']),
  intervalos: z.object({ largura: z.number().positive().finite().optional() }).optional(),
});

export const esquemaEstadoGrafico = z.object({
  colecaoId: z.string(),
  x: esquemaEixo.nullable().default(null),
  y: esquemaEixo.nullable().default(null),
  corPor: z.string().min(1).optional(),
  icone: z
    .object({
      forma: z.enum(FORMAS_ICONE).default('circulo'),
      tamanho: z.number().finite().min(TAMANHO_ICONE_MIN).max(TAMANHO_ICONE_MAX).default(TAMANHO_ICONE_PADRAO),
    })
    .default({ forma: 'circulo', tamanho: TAMANHO_ICONE_PADRAO }),
  mostrar: z.array(z.enum(['media', 'mediana', 'moda', 'contagem', 'porcentagem'])).default([]),
  filtro: z.string().optional(),
  semente: z.number().int().default(1),
});

export function sementeAleatoria(): number {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

export function estadoPadrao(colecaoId = '', semente: number = sementeAleatoria()): EstadoGrafico {
  return {
    colecaoId,
    x: null,
    y: null,
    icone: { forma: 'circulo', tamanho: TAMANHO_ICONE_PADRAO },
    mostrar: [],
    semente,
  };
}

/** Valida um estado vindo do arquivo; devolve null se for inválido. */
export function validarEstado(bruto: unknown): EstadoGrafico | null {
  const r = esquemaEstadoGrafico.safeParse(bruto);
  if (!r.success) return null;
  const e = r.data;
  const saida: EstadoGrafico = {
    colecaoId: e.colecaoId,
    x: e.x,
    y: e.y,
    icone: e.icone,
    mostrar: ordenarMedidas([...new Set(e.mostrar)]),
    semente: e.semente,
  };
  if (e.corPor !== undefined) saida.corPor = e.corPor;
  if (e.filtro !== undefined) saida.filtro = e.filtro;
  return saida;
}

/** Estado válido ou, se o objeto ainda não tem estado (ou está corrompido), o padrão. */
export function lerEstado(bruto: unknown, colecaoIdPadrao = ''): EstadoGrafico {
  return validarEstado(bruto) ?? estadoPadrao(colecaoIdPadrao, 1);
}

function ordenarMedidas(m: Medida[]): Medida[] {
  return [...m].sort((a, b) => MEDIDAS.indexOf(a) - MEDIDAS.indexOf(b));
}

function eixo(e: EstadoGrafico, qual: QualEixo): EixoCfg | null {
  return qual === 'x' ? e.x : e.y;
}

function comEixo(e: EstadoGrafico, qual: QualEixo, novo: EixoCfg | null): EstadoGrafico {
  return qual === 'x' ? { ...e, x: novo } : { ...e, y: novo };
}

/**
 * Escolhe o atributo de um eixo. Mantém o modo atual do eixo (ou 'separar') salvo se `modo` for dado;
 * a largura dos intervalos só é mantida se o atributo for o mesmo.
 */
export function definirEixo(e: EstadoGrafico, qual: QualEixo, atributoId: string, modo?: ModoEixo): EstadoGrafico {
  const atual = eixo(e, qual);
  const novo: EixoCfg = { atributoId, modo: modo ?? atual?.modo ?? 'separar' };
  if (atual && atual.atributoId === atributoId && atual.intervalos) novo.intervalos = { ...atual.intervalos };
  return comEixo(e, qual, novo);
}

export function trocarEixos(e: EstadoGrafico): EstadoGrafico {
  return { ...e, x: e.y, y: e.x };
}

export function removerEixo(e: EstadoGrafico, qual: QualEixo): EstadoGrafico {
  return comEixo(e, qual, null);
}

export function definirModo(e: EstadoGrafico, qual: QualEixo, modo: ModoEixo): EstadoGrafico {
  const atual = eixo(e, qual);
  if (!atual) return e;
  return comEixo(e, qual, { ...atual, modo });
}

/** Largura dos intervalos; `undefined` volta à largura automática (regra de Sturges). */
export function definirLarguraIntervalos(e: EstadoGrafico, qual: QualEixo, largura: number | undefined): EstadoGrafico {
  const atual = eixo(e, qual);
  if (!atual) return e;
  const { intervalos: _antigo, ...resto } = atual;
  const valida = largura !== undefined && Number.isFinite(largura) && largura > 0;
  return comEixo(e, qual, valida ? { ...resto, intervalos: { largura } } : resto);
}

export function alternarMedida(e: EstadoGrafico, medida: Medida): EstadoGrafico {
  const tem = e.mostrar.includes(medida);
  const lista = tem ? e.mostrar.filter((m) => m !== medida) : [...e.mostrar, medida];
  return { ...e, mostrar: ordenarMedidas(lista) };
}

export function definirCorPor(e: EstadoGrafico, atributoId: string | undefined): EstadoGrafico {
  const { corPor: _antiga, ...resto } = e;
  return atributoId ? { ...resto, corPor: atributoId } : resto;
}

export function definirIcone(e: EstadoGrafico, parcial: Partial<IconeCfg>): EstadoGrafico {
  const tamanhoBruto = parcial.tamanho ?? e.icone.tamanho;
  const tamanho = Number.isFinite(tamanhoBruto)
    ? Math.min(TAMANHO_ICONE_MAX, Math.max(TAMANHO_ICONE_MIN, Math.round(tamanhoBruto)))
    : e.icone.tamanho;
  return { ...e, icone: { forma: parcial.forma ?? e.icone.forma, tamanho } };
}

export function definirFiltro(e: EstadoGrafico, filtro: string | undefined): EstadoGrafico {
  const { filtro: _antigo, ...resto } = e;
  return filtro !== undefined && filtro.trim() !== '' ? { ...resto, filtro } : resto;
}

/** Nova nuvem aleatória: nova semente e volta à nuvem (sem eixos). */
export function remexer(e: EstadoGrafico, semente: number = sementeAleatoria()): EstadoGrafico {
  const nova = semente === e.semente ? semente + 1 : semente;
  return { ...e, x: null, y: null, semente: nova };
}
