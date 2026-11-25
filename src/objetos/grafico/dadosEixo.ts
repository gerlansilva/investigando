// Conversão de valores de casos para os formatos dos algoritmos (sem DOM).
import type { Atributo, Caso, ValorCelula } from '../../modelo/tipos';
import type { ConfigEixo } from '../../grafico/algoritmos/posicoes';
import type { Valor } from '../../grafico/algoritmos/tipos';
import type { EixoCfg } from './estado';

/** Número de uma célula; textos como "3,5" também valem. Outros valores viram null. */
export function valorNumerico(v: ValorCelula | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^[+-]?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  }
  return null;
}

export interface EixoResolvido {
  cfg: ConfigEixo;
  atributo: Atributo | undefined;
  /** Valores numéricos por caso (só em eixo numérico). */
  numeros: (number | null)[] | null;
}

export function ordemDeDatas(casos: readonly Caso[], id: string): string[] {
  const vistos = new Set<string>();
  for (const c of casos) {
    const v = c.valores[id];
    if (v !== null && v !== undefined) vistos.add(String(v));
  }
  return [...vistos].sort();
}

/** Monta a configuração de um eixo para `calcularPosicoes`. Atributo inexistente = eixo desligado. */
export function resolverEixo(eixo: EixoCfg | null, atributos: readonly Atributo[], casos: readonly Caso[]): EixoResolvido {
  const atributo = eixo ? atributos.find((a) => a.id === eixo.atributoId) : undefined;
  if (!eixo || !atributo) return { cfg: { tipo: 'nenhum' }, atributo: undefined, numeros: null };
  if (atributo.tipo === 'numerico') {
    const numeros = casos.map((c) => valorNumerico(c.valores[atributo.id]));
    const cfg: ConfigEixo = { tipo: 'numerico', modo: eixo.modo, valores: numeros, virgulaDecimal: true };
    if (eixo.intervalos?.largura !== undefined) cfg.larguraIntervalo = eixo.intervalos.largura;
    return { cfg, atributo, numeros };
  }
  const valores: Valor[] = casos.map((c) => c.valores[atributo.id] ?? null);
  const cfg: ConfigEixo = { tipo: 'categorico', modo: eixo.modo, valores };
  if (atributo.tipo === 'data') cfg.ordemCategorias = ordemDeDatas(casos, atributo.id);
  return { cfg, atributo, numeros: null };
}
