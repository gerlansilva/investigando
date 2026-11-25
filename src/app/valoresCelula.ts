import type { Atributo, ValorCelula } from '../modelo/tipos';
import { t } from '../i18n/pt-BR';

/**
 * Converte texto digitado em número aceitando vírgula ou ponto como separador decimal.
 * Se houver os dois, o último deles é o decimal e o outro é separador de milhar.
 * Devolve null se não for um número.
 */
export function analisarNumero(entrada: string): number | null {
  let s = entrada.trim().replace(/\s+/g, '');
  if (s === '') return null;
  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');
  if (ultimaVirgula !== -1 && ultimoPonto !== -1) {
    if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (ultimaVirgula !== -1) {
    if (s.indexOf(',') !== ultimaVirgula) return null;
    s = s.replace(',', '.');
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatarNumero(n: number, casas?: number): string {
  return n.toLocaleString('pt-BR', {
    useGrouping: false,
    maximumFractionDigits: casas ?? 6,
    ...(casas !== undefined ? { minimumFractionDigits: casas } : {}),
  });
}

export function formatarValor(valor: ValorCelula | undefined, atributo: Atributo): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return formatarNumero(valor, atributo.formato?.casas);
  return valor;
}

export type ResultadoEntrada = { ok: true; valor: ValorCelula } | { ok: false; mensagem: string };

/** Interpreta o que foi digitado numa célula de acordo com o tipo do atributo. */
export function converterEntrada(atributo: Atributo, texto: string): ResultadoEntrada {
  if (texto.trim() === '') return { ok: true, valor: null };
  if (atributo.tipo === 'numerico') {
    const n = analisarNumero(texto);
    return n === null ? { ok: false, mensagem: t.tabela.valorNaoNumerico } : { ok: true, valor: n };
  }
  return { ok: true, valor: texto.trim() };
}

export function rotuloTipo(tipo: Atributo['tipo']): string {
  return t.tabela.tipos[tipo];
}

export function tituloAtributo(atributo: Atributo): string {
  return atributo.unidade ? `${atributo.nome} (${atributo.unidade})` : atributo.nome;
}

export function eCalculado(atributo: Atributo): boolean {
  return !!atributo.formula && atributo.formula.trim() !== '';
}
