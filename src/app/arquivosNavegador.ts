// Abrir e salvar `.investigando` no navegador (download/upload). A ponte Tauri vem na fase 7;
// todo acesso a arquivos do navegador fica isolado aqui.
import { abrirProjeto, ErroArquivo } from '../modelo';
import type { Projeto } from '../modelo/tipos';
import { t } from '../i18n/pt-BR';

export const EXTENSAO = '.investigando';

export function nomeDeArquivo(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'projeto'}${EXTENSAO}`;
}

function lerTexto(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => (typeof leitor.result === 'string' ? resolve(leitor.result) : reject(new ErroArquivo(t.app.erroLerArquivo)));
    leitor.onerror = () => reject(new ErroArquivo(t.app.erroLerArquivo));
    leitor.readAsText(arquivo);
  });
}

/** Lê um arquivo escolhido pelo usuário. Lança ErroArquivo com mensagem em português se for inválido. */
export async function lerArquivoProjeto(arquivo: File): Promise<Projeto> {
  const texto = await lerTexto(arquivo);
  return abrirProjeto(texto);
}

/** Baixa o projeto como arquivo. `texto` vem de `armazem.serializar()`. Devolve o nome do arquivo. */
export function baixarProjeto(texto: string, titulo: string): string {
  const nome = nomeDeArquivo(titulo);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nome;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return nome;
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroArquivo) return erro.message;
  return t.app.erroAbrir;
}
