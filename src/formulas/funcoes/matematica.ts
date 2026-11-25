import { ErroDeFuncao, paraNumero } from '../valores';
import type { DefinicaoFuncao } from './tipos';

function arredondarCasas(x: number, casas: number): number {
  const c = Math.trunc(casas);
  const sinal = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const texto = `${abs}e${c}`;
  if (!Number.isNaN(Number(texto)) && !String(abs).includes('e')) {
    const deslocado = Math.round(Number(texto));
    return sinal * Number(`${deslocado}e${-c}`);
  }
  const f = 10 ** c;
  return (sinal * Math.round(abs * f)) / f;
}

function unaria(nome: string, aliases: string[], f: (x: number) => number): DefinicaoFuncao {
  return {
    nome, aliases, min: 1, max: 1,
    executar: ([v]) => {
      const x = paraNumero(v!);
      return x === null ? null : f(x);
    },
  };
}

export const funcoesMatematica: DefinicaoFuncao[] = [
  {
    nome: 'arredondar', aliases: ['round'], min: 1, max: 2,
    executar: ([v, casas]) => {
      const x = paraNumero(v!);
      if (x === null) return null;
      return arredondarCasas(x, casas === undefined ? 0 : (paraNumero(casas) ?? 0));
    },
  },
  unaria('absoluto', ['abs'], Math.abs),
  unaria('piso', ['floor'], Math.floor),
  unaria('teto', ['ceil'], Math.ceil),
  unaria('raiz', ['sqrt'], (x) => {
    if (x < 0) throw new ErroDeFuncao('Não existe raiz quadrada de número negativo');
    return Math.sqrt(x);
  }),
  {
    nome: 'potência', aliases: ['pow'], min: 2, max: 2,
    executar: ([a, b]) => {
      const base = paraNumero(a!);
      const expoente = paraNumero(b!);
      return base === null || expoente === null ? null : base ** expoente;
    },
  },
];
