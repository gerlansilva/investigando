import { normalizarNome } from '../valores';
import { funcoesAleatorio } from './aleatorio';
import { funcoesCaso } from './caso';
import { funcoesEstatistica } from './estatistica';
import { funcoesMatematica } from './matematica';
import { funcoesTexto } from './texto';
import type { DefinicaoFuncao } from './tipos';

export const funcoesDisponiveis: DefinicaoFuncao[] = [
  ...funcoesMatematica, ...funcoesEstatistica, ...funcoesTexto, ...funcoesAleatorio, ...funcoesCaso,
];

const porNome = new Map<string, DefinicaoFuncao>();
for (const def of funcoesDisponiveis) {
  for (const nome of [def.nome, ...def.aliases]) porNome.set(normalizarNome(nome), def);
}

export function buscarFuncao(nome: string): DefinicaoFuncao | undefined {
  return porNome.get(normalizarNome(nome));
}

export { criarPrng, hashTexto } from './prng';
export type { DefinicaoFuncao, ContextoFuncao } from './tipos';
