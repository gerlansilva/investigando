import type { Id } from '../../modelo/tipos';
import { criarComando, exigirColecao, type Comando } from './base';

/** Apaga todos os casos da coleção (os atributos ficam). */
export function limparCasos(colecaoId: Id): Comando {
  return criarComando({
    rotulo: 'Limpar casos',
    receita: (p) => {
      exigirColecao(p, colecaoId).casos = [];
    },
  });
}
