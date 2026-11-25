import type { No } from '../parser';
import type { Contexto, Valor } from '../tipos';

export interface ContextoFuncao extends Contexto {
  rng: () => number;
  indice: number;
}

export interface DefinicaoFuncao {
  nome: string;
  aliases: string[];
  min: number;
  max: number;
  agregacao?: boolean;
  executar?: (args: Valor[], ctx: ContextoFuncao) => Valor;
  especial?: (nos: No[], ctx: Contexto, avaliar: (no: No, ctx: Contexto) => Valor) => Valor;
}
