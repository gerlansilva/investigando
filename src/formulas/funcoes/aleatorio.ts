import type { Valor } from '../tipos';
import { ErroDeFuncao, paraNumero } from '../valores';
import type { DefinicaoFuncao } from './tipos';

function limites(a: Valor, b: Valor): [number, number] | null {
  const x = paraNumero(a);
  const y = paraNumero(b);
  if (x === null || y === null) return null;
  if (x > y) throw new ErroDeFuncao('O primeiro número precisa ser menor ou igual ao segundo');
  return [x, y];
}

export const funcoesAleatorio: DefinicaoFuncao[] = [
  {
    nome: 'aleatório', aliases: ['random'], min: 0, max: 2,
    executar: (args, ctx) => {
      if (args.length === 1) throw new ErroDeFuncao("A função 'aleatório' recebe nenhum número ou dois (o menor e o maior)");
      if (args.length === 0) return ctx.rng();
      const l = limites(args[0]!, args[1]!);
      return l === null ? null : l[0] + ctx.rng() * (l[1] - l[0]);
    },
  },
  {
    nome: 'inteiroAleatório', aliases: ['randomInt'], min: 2, max: 2,
    executar: ([a, b], ctx) => {
      const l = limites(a!, b!);
      if (l === null) return null;
      const menor = Math.ceil(l[0]);
      const maior = Math.floor(l[1]);
      if (menor > maior) throw new ErroDeFuncao('Não existe número inteiro entre os valores dados');
      return menor + Math.floor(ctx.rng() * (maior - menor + 1));
    },
  },
];
