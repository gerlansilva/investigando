// Tipos do simulador (lógica pura: sem React nem DOM).
import type { ValorCelula } from '../modelo/tipos';

export type TipoDispositivo = 'roleta' | 'misturador' | 'contador';
export const TIPOS_DISPOSITIVO: readonly TipoDispositivo[] = ['roleta', 'misturador', 'contador'];

/** Limites de segurança: protegem o app de pedidos exagerados. */
export const LIMITE_ITENS_POR_REPETICAO = 10_000;
export const LIMITE_REPETICOES = 100_000;
/** Máximo de repetições de 'rodar até que' (e da coleta de estatística pela interface). */
export const LIMITE_SEGURANCA = 10_000;
export const LIMITE_BOLAS_POR_TIPO = 100_000;
/** Máximo de casos que uma execução pela interface pode gerar. */
export const LIMITE_CASOS = 100_000;

export interface Setor {
  nome: string;
  proporcao: number;
  cor: string;
}

export interface Bola {
  nome: string;
  quantidade: number;
  cor: string;
}

export interface Roleta {
  tipo: 'roleta';
  setores: Setor[];
}

export interface Misturador {
  tipo: 'misturador';
  bolas: Bola[];
  /** true: a bola sorteada volta para o misturador a cada sorteio. */
  reposicao: boolean;
  /** Só vale sem reposição: true = o misturador volta a ficar cheio no começo de cada repetição. */
  reporEntreRepeticoes: boolean;
}

export interface Contador {
  tipo: 'contador';
  /** 'ate': 1, 2, ..., N. 'lista': os valores de `valores`, na ordem. */
  modo: 'ate' | 'lista';
  ate: number;
  valores: string[];
}

export type Dispositivo = Roleta | Misturador | Contador;

export type TipoColuna = 'repeticao' | 'item' | 'valor' | 'contagem' | 'soma' | 'media' | 'minimo' | 'maximo';
export const TIPOS_COLUNA: readonly TipoColuna[] = ['repeticao', 'item', 'valor', 'contagem', 'soma', 'media', 'minimo', 'maximo'];

/** Uma coluna do resultado (vira um atributo da coleção; `id` é o id do atributo). */
export interface ColunaResultado {
  id: string;
  nome: string;
  tipo: TipoColuna;
  /** Só para 'contagem': o nome do elemento contado. */
  elemento?: string;
}

export interface ConfigSimulacao {
  dispositivo: Dispositivo;
  itensPorRepeticao: number;
  colunas: ColunaResultado[];
}

/** Um item sorteado. */
export interface Sorteio {
  /** Posição do setor/bola/valor no dispositivo (0 a n-1). */
  indice: number;
  nome: string;
  /** Número quando o nome é numérico ("3", "2,5"); senão o próprio nome. */
  valor: number | string;
  cor?: string;
}

export type LinhaResultado = Record<string, ValorCelula>;

export interface Repeticao {
  /** 1, 2, 3... */
  numero: number;
  itens: Sorteio[];
  /** Uma linha por item, com as colunas configuradas. */
  linhas: LinhaResultado[];
}

export interface ConfigEstatistica {
  /** Fórmula avaliada sobre os resultados de cada repetição. Ex.: contagem(se([Resultado] = "Cara", 1)). */
  formula: string;
  /** Nome do atributo na coleção de estatísticas. */
  rotulo: string;
  /** Fórmula booleana avaliada depois de cada repetição sobre as estatísticas coletadas até ali. */
  rodarAteQue?: string;
  /** Máximo de repetições de 'rodar até que' (no máximo 10.000). */
  limite?: number;
}

export type MotivoParada = 'completo' | 'condicao' | 'limite';

export interface LinhaEstatistica {
  repeticao: number;
  valor: ValorCelula;
}

export interface ResultadoEstatistica {
  linhas: LinhaEstatistica[];
  motivo: MotivoParada;
  tipo: 'numerico' | 'categorico';
}
