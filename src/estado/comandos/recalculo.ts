import { current, isDraft } from 'immer';
import type { Colecao, Projeto } from '../../modelo/tipos';
import { hashTexto, recalcularColecao } from '../../formulas';

export function recalcularCalculados(p: Projeto, colecao: Colecao): void {
  if (!colecao.atributos.some((a) => a.formula && a.formula.trim() !== '')) return;
  const leitura = isDraft(colecao) ? current(colecao) : colecao;
  const globais = isDraft(p.globais) ? current(p.globais) : p.globais;
  const resultados = recalcularColecao(leitura, globais, hashTexto(p.id));
  for (const [atributoId, r] of Object.entries(resultados)) {
    colecao.casos.forEach((caso, i) => {
      const valor = r.valores[i] ?? null;
      if (caso.valores[atributoId] !== valor) caso.valores[atributoId] = valor;
    });
  }
}

export function recalcularTudo(p: Projeto): void {
  for (const colecao of p.colecoes) recalcularCalculados(p, colecao);
}
