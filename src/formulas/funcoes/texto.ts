import { paraTexto } from '../valores';
import type { DefinicaoFuncao } from './tipos';

export const funcoesTexto: DefinicaoFuncao[] = [
  {
    nome: 'concatenar', aliases: ['concat', 'concatenate'], min: 1, max: Infinity,
    executar: (args) => args.map(paraTexto).join(''),
  },
  { nome: 'comprimento', aliases: ['length'], min: 1, max: 1, executar: ([v]) => paraTexto(v!).length },
  { nome: 'maiúsculas', aliases: ['upper'], min: 1, max: 1, executar: ([v]) => paraTexto(v!).toUpperCase() },
  { nome: 'minúsculas', aliases: ['lower'], min: 1, max: 1, executar: ([v]) => paraTexto(v!).toLowerCase() },
];
