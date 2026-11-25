import { paraBooleano } from '../valores';
import type { DefinicaoFuncao } from './tipos';

export const funcoesCaso: DefinicaoFuncao[] = [
  {
    nome: 'se', aliases: ['if'], min: 2, max: 3,
    especial: (nos, ctx, avaliar) => {
      const condicao = paraBooleano(avaliar(nos[0]!, ctx));
      if (condicao) return avaliar(nos[1]!, ctx);
      return nos[2] ? avaliar(nos[2], ctx) : null;
    },
  },
  { nome: 'indiceDoCaso', aliases: ['caseIndex'], min: 0, max: 0, executar: (_args, ctx) => ctx.indice },
];
