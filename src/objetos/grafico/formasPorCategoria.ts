// Um ícone diferente para cada valor de uma categoria (ex.: peixe para peixes, ave para aves).
import type { Caso, Colecao } from '../../modelo/tipos';
import { textos } from './textos';
import type { FormaIcone } from './formas';

/** Ordem em que as formas são dadas às categorias (o círculo fica por último, para as formas se distinguirem logo). */
export const FORMAS_DAS_CATEGORIAS: readonly FormaIcone[] = [
  'triangulo', 'quadrado', 'estrela', 'coracao', 'folha', 'peixe', 'passaro', 'pinguim', 'dinossauro', 'pessoa', 'circulo',
];

const SEMANTICAS: ReadonlyArray<readonly [RegExp, FormaIcone]> = [
  [/^peixe/, 'peixe'], [/^(ave|passaro)/, 'passaro'], [/^pinguim/, 'pinguim'], [/^dinossauro/, 'dinossauro'],
  [/^(folha|planta)/, 'folha'], [/^(pessoa|humano|crianca|menino|menina)/, 'pessoa'], [/^coracao/, 'coracao'], [/^estrela/, 'estrela'],
];

function semantica(rotulo: string): FormaIcone | undefined {
  const r = rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return SEMANTICAS.find(([re]) => re.test(r))?.[1];
}

export interface LegendaFormas {
  titulo: string;
  itens: { rotulo: string; forma: FormaIcone }[];
}

export interface ResultadoFormas {
  /** Uma forma por caso (na ordem de `casos`), ou `null` quando não há atributo de formas. */
  formas: FormaIcone[] | null;
  legenda: LegendaFormas | null;
}

export function calcularFormas(colecao: Colecao | undefined, casos: readonly Caso[], atributoId: string | undefined): ResultadoFormas {
  const atributo = atributoId ? colecao?.atributos.find((a) => a.id === atributoId) : undefined;
  if (!colecao || !atributo) return { formas: null, legenda: null };
  const rotuloDe = (c: Caso): string => {
    const v = c.valores[atributo.id];
    return v === null || v === undefined || v === '' ? textos.semValor : String(v);
  };
  const rotulos: string[] = [];
  for (const c of colecao.casos) {
    const r = rotuloDe(c);
    if (!rotulos.includes(r)) rotulos.push(r);
  }
  // categorias com nome conhecido (peixe, ave…) ganham o ícone que as representa; as outras recebem as formas livres
  const ordem = new Map<string, FormaIcone>();
  const usadas = new Set<FormaIcone>();
  for (const r of rotulos) {
    const f = semantica(r);
    if (f && !usadas.has(f)) { ordem.set(r, f); usadas.add(f); }
  }
  const livres = FORMAS_DAS_CATEGORIAS.filter((f) => !usadas.has(f));
  let k = 0;
  for (const r of rotulos) if (!ordem.has(r)) ordem.set(r, livres[k++ % Math.max(1, livres.length)] ?? 'circulo');
  const formas = casos.map((c) => ordem.get(rotuloDe(c)) ?? 'circulo');
  const usados = new Set(casos.map(rotuloDe));
  const itens = [...ordem].filter(([r]) => usados.has(r)).map(([rotulo, forma]) => ({ rotulo, forma }));
  return { formas, legenda: { titulo: atributo.nome, itens } };
}
