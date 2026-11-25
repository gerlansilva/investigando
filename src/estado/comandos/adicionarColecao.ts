import type { Colecao } from '../../modelo/tipos';
import { criarComando, ErroComando, type Comando } from './base';
import { recalcularCalculados } from './recalculo';

/** Acrescenta uma coleção inteira (atributos e casos) ao projeto. */
export function adicionarColecao(colecao: Colecao, posicao?: number): Comando {
  return criarComando({
    rotulo: `Adicionar coleção '${colecao.nome}'`,
    receita: (p) => {
      if (p.colecoes.some((c) => c.id === colecao.id)) throw new ErroComando('Já existe uma coleção com esse identificador.');
      const ids = new Set<string>();
      for (const a of colecao.atributos) {
        if (ids.has(a.id)) throw new ErroComando(`A coleção tem dois atributos com o mesmo identificador ('${a.id}').`);
        ids.add(a.id);
      }
      const nova = structuredClone(colecao);
      p.colecoes.splice(posicao ?? p.colecoes.length, 0, nova);
      recalcularCalculados(p, p.colecoes.find((c) => c.id === nova.id)!);
    },
  });
}
