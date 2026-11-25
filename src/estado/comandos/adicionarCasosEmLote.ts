import type { Caso, Id } from '../../modelo/tipos';
import { criarComando, ErroComando, exigirColecao, type Comando } from './base';
import { recalcularCalculados } from './recalculo';

/** Acrescenta muitos casos de uma vez; é um único passo no desfazer, e as fórmulas são recalculadas uma só vez. */
export function adicionarCasosEmLote(colecaoId: Id, casos: readonly Caso[]): Comando {
  return criarComando({
    rotulo: casos.length === 1 ? 'Adicionar caso' : `Adicionar ${casos.length} casos`,
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      const conhecidos = new Set(colecao.atributos.map((a) => a.id));
      const existentes = new Set(colecao.casos.map((c) => c.id));
      for (const caso of casos) {
        if (existentes.has(caso.id)) throw new ErroComando(`Já existe um caso com o identificador '${caso.id}' nessa coleção.`);
        existentes.add(caso.id);
        const orfao = Object.keys(caso.valores).find((chave) => !conhecidos.has(chave));
        if (orfao) throw new ErroComando(`Um dos casos tem valor para um atributo que não existe ('${orfao}').`);
      }
      for (const caso of casos) {
        const novo = structuredClone(caso);
        for (const id of conhecidos) if (!(id in novo.valores)) novo.valores[id] = null;
        colecao.casos.push(novo);
      }
      recalcularCalculados(p, colecao);
    },
  });
}
