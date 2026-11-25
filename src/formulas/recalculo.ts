import type { Atributo, Colecao, Id, ValorCelula } from '../modelo/tipos';
import { acharAtributo, avaliarArvore } from './avaliador';
import { ErroFormula } from './erro';
import { criarPrng, hashTexto } from './funcoes';
import { compilar, referenciasDe } from './parser';
import { paraValorDeCaso } from './valores';

export interface ResultadoAtributo {
  valores: ValorCelula[];
  erros: (ErroFormula | null)[];
}

function falhaGeral(colecao: Colecao, erro: ErroFormula): ResultadoAtributo {
  return { valores: colecao.casos.map(() => null), erros: colecao.casos.map(() => erro) };
}

function dependenciasDiretas(colecao: Colecao, atributo: Atributo): Atributo[] {
  const compilada = atributo.formula ? compilar(atributo.formula) : null;
  if (!compilada?.ok) return [];
  const achados = referenciasDe(compilada.arvore)
    .map((nome) => acharAtributo(colecao, nome))
    .filter((a): a is Atributo => a !== undefined);
  return achados;
}

export function recalcularAtributo(
  colecao: Colecao,
  atributoId: Id,
  globais: Record<string, number>,
  semente = 0,
): ResultadoAtributo {
  const atributo = colecao.atributos.find((a) => a.id === atributoId);
  if (!atributo) throw new Error(`Atributo '${atributoId}' não existe na coleção '${colecao.nome}'`);
  if (!atributo.formula || atributo.formula.trim() === '') {
    return {
      valores: colecao.casos.map((c) => c.valores[atributo.id] ?? null),
      erros: colecao.casos.map(() => null),
    };
  }

  const compilada = compilar(atributo.formula);
  if (!compilada.ok) return falhaGeral(colecao, compilada.erro);

  if (dependenciasDiretas(colecao, atributo).some((d) => d.id === atributo.id)) {
    return falhaGeral(colecao, new ErroFormula(`A fórmula de '${atributo.nome}' usa o próprio atributo`, 0, atributo.formula.length));
  }

  const rng = criarPrng((semente ^ hashTexto(atributo.id)) >>> 0);
  const valores: ValorCelula[] = [];
  const erros: (ErroFormula | null)[] = [];
  colecao.casos.forEach((caso, i) => {
    const r = avaliarArvore(compilada.arvore, { caso, colecao, globais, rng, indice: i + 1 });
    valores.push(r.ok ? paraValorDeCaso(r.valor) : null);
    erros.push(r.ok ? null : r.erro);
  });
  return { valores, erros };
}

function ordemDeCalculo(colecao: Colecao): { ordem: Atributo[]; emCiclo: Set<Id> } {
  const calculados = colecao.atributos.filter((a) => a.formula && a.formula.trim() !== '');
  const ids = new Set(calculados.map((a) => a.id));
  const ordem: Atributo[] = [];
  const estado = new Map<Id, 'visitando' | 'pronto'>();
  const emCiclo = new Set<Id>();

  const visitar = (a: Atributo): boolean => {
    const s = estado.get(a.id);
    if (s === 'pronto') return true;
    if (s === 'visitando') return false;
    estado.set(a.id, 'visitando');
    let ok = true;
    for (const d of dependenciasDiretas(colecao, a)) {
      if (d.id === a.id || !ids.has(d.id)) continue;
      if (!visitar(d)) ok = false;
    }
    estado.set(a.id, 'pronto');
    if (ok) ordem.push(a);
    else emCiclo.add(a.id);
    return ok;
  };
  calculados.forEach(visitar);
  return { ordem, emCiclo };
}

export function recalcularColecao(
  colecao: Colecao,
  globais: Record<string, number>,
  semente = 0,
): Record<Id, ResultadoAtributo> {
  const trabalho: Colecao = {
    ...colecao,
    casos: colecao.casos.map((c) => ({ ...c, valores: { ...c.valores } })),
  };
  const { ordem, emCiclo } = ordemDeCalculo(colecao);
  const resultados: Record<Id, ResultadoAtributo> = {};

  for (const atributo of ordem) {
    const r = recalcularAtributo(trabalho, atributo.id, globais, semente);
    resultados[atributo.id] = r;
    trabalho.casos.forEach((caso, i) => {
      caso.valores[atributo.id] = r.valores[i] ?? null;
    });
  }
  for (const id of emCiclo) {
    const atributo = colecao.atributos.find((a) => a.id === id)!;
    resultados[id] = falhaGeral(colecao, new ErroFormula(`Há fórmulas que dependem uma da outra, envolvendo '${atributo.nome}'`, 0, atributo.formula?.length ?? 0));
  }
  return resultados;
}
