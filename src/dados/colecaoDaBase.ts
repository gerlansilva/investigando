import { criarAtributo, criarCaso, criarColecao } from '../modelo/fabrica';
import type { Colecao, ValorCelula } from '../modelo/tipos';
import type { BaseDeDados } from './bases';

/** Cria uma coleção nova (identificadores novos) com os dados da base. */
export function colecaoDaBase(base: BaseDeDados): Colecao {
  const atributos = base.atributos.map(([nome, tipo, unidade], i) =>
    criarAtributo({ nome, tipo, indiceCor: i, ...(unidade ? { unidade } : {}) }));
  const casos = base.linhas.map((linha) => {
    const valores: Record<string, ValorCelula> = {};
    atributos.forEach((a, i) => {
      const v = linha[i] ?? null;
      valores[a.id] = v === null ? null : a.tipo === 'numerico' ? Number(v) : String(v);
    });
    return criarCaso(valores);
  });
  return criarColecao(base.nome, atributos, casos);
}
