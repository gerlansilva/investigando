import { tentarNumero } from '../valores';
import type { Valor } from '../tipos';
import type { DefinicaoFuncao } from './tipos';

export function numerosDe(valores: Valor[]): number[] {
  const numeros: number[] = [];
  for (const v of valores) {
    const n = tentarNumero(v);
    if (n !== undefined) numeros.push(n);
  }
  return numeros;
}

const somar = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function media(xs: number[]): number | null {
  return xs.length === 0 ? null : somar(xs) / xs.length;
}

export function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const ord = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 ? ord[meio]! : (ord[meio - 1]! + ord[meio]!) / 2;
}

export function desvioPadraoAmostral(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = somar(xs) / xs.length;
  return Math.sqrt(somar(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

const agregar = (nome: string, aliases: string[], f: (xs: number[]) => number | null): DefinicaoFuncao => ({
  nome, aliases, min: 1, max: Infinity, agregacao: true,
  executar: (args) => f(numerosDe(args)),
});

export const funcoesEstatistica: DefinicaoFuncao[] = [
  agregar('soma', ['sum'], somar),
  agregar('média', ['mean', 'average'], media),
  agregar('mediana', ['median'], mediana),
  agregar('mínimo', ['min'], (xs) => (xs.length ? Math.min(...xs) : null)),
  agregar('máximo', ['max'], (xs) => (xs.length ? Math.max(...xs) : null)),
  agregar('desvioPadrão', ['stdev'], desvioPadraoAmostral),
  {
    nome: 'contagem', aliases: ['count'], min: 0, max: Infinity, agregacao: true,
    executar: (args) => args.filter((v) => v !== null && v !== '').length,
  },
];
