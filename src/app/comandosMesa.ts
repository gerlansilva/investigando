import { criarComando, type Comando } from '../estado/comandos';
import type { Colecao, ObjetoMesa } from '../modelo/tipos';

/** Cria, num único passo do histórico, uma coleção nova e o objeto da mesa ligado a ela. */
export function criarObjetoComColecao(rotulo: string, colecao: Colecao, objeto: ObjetoMesa): Comando {
  return criarComando({
    rotulo,
    receita: (p) => {
      p.colecoes.push(structuredClone(colecao));
      p.objetos.push(structuredClone(objeto));
    },
  });
}

/** Move vários objetos de uma vez, num único passo do histórico. */
export function moverObjetos(posicoes: ReadonlyMap<string, { x: number; y: number }>): Comando {
  return criarComando({
    rotulo: 'Organizar objetos',
    receita: (p) => {
      for (const o of p.objetos) {
        const pos = posicoes.get(o.id);
        if (pos) {
          o.x = pos.x;
          o.y = pos.y;
        }
      }
    },
  });
}
