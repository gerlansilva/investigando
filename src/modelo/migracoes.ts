import { ErroArquivo } from './erros';

export const VERSAO_ATUAL = 1;

type Migracao = (dado: Record<string, unknown>) => Record<string, unknown>;

const migracoes: Record<number, Migracao> = {};

export function migrar(dado: unknown): unknown {
  if (typeof dado !== 'object' || dado === null || Array.isArray(dado)) {
    throw new ErroArquivo('O arquivo não parece ser um projeto do Investigando.');
  }
  let atual = dado as Record<string, unknown>;
  const versao = atual.versao;
  if (typeof versao !== 'number' || !Number.isInteger(versao) || versao < 1) {
    throw new ErroArquivo('O arquivo não informa a versão do projeto, então não dá para abri-lo.');
  }
  if (versao > VERSAO_ATUAL) {
    throw new ErroArquivo(
      `Este projeto foi salvo numa versão mais nova (versão ${versao}) do Investigando. Atualize o programa para abri-lo.`,
    );
  }
  for (let v = versao; v < VERSAO_ATUAL; v++) {
    const passo = migracoes[v];
    if (!passo) throw new ErroArquivo(`Não sei converter projetos da versão ${v}.`);
    atual = { ...passo(atual), versao: v + 1 };
  }
  return atual;
}
