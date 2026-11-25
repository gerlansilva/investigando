// Filtro de casos por fórmula (usa src/formulas). Sem DOM.
import type { Caso, Colecao } from '../../modelo/tipos';
import { avaliarArvore, compilar } from '../../formulas';
import { paraBooleano } from '../../formulas/valores';

export interface ResultadoFiltro {
  /** Casos não ocultos que passam no filtro. Se a fórmula tem erro, o filtro é ignorado. */
  casos: Caso[];
  /** Mensagem em português (da própria fórmula), ou null se está tudo certo. */
  erro: string | null;
  filtrando: boolean;
}

export function aplicarFiltro(colecao: Colecao, filtro: string | undefined, globais: Record<string, number> = {}): ResultadoFiltro {
  const naoOcultos = colecao.casos.filter((c) => !c.oculto);
  const texto = filtro?.trim() ?? '';
  if (texto === '') return { casos: naoOcultos, erro: null, filtrando: false };
  const compilada = compilar(texto);
  if (!compilada.ok) return { casos: naoOcultos, erro: compilada.erro.mensagem, filtrando: false };
  const passam: Caso[] = [];
  for (let i = 0; i < naoOcultos.length; i++) {
    const caso = naoOcultos[i]!;
    const r = avaliarArvore(compilada.arvore, { caso, colecao, globais, indice: i + 1 });
    if (!r.ok) return { casos: naoOcultos, erro: r.erro.mensagem, filtrando: false };
    if (paraBooleano(r.valor)) passam.push(caso);
  }
  return { casos: passam, erro: null, filtrando: true };
}
