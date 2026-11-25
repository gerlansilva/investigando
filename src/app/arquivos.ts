// Interface única de arquivos do app. Usa Tauri (diálogos nativos) quando `window.__TAURI_INTERNALS__`
// existe e cai em `arquivosNavegador.ts` caso contrário. O resto do app só importa este módulo.
import { abrirProjeto } from '../modelo';
import type { Projeto } from '../modelo/tipos';
import { baixarProjeto, EXTENSAO, lerArquivoProjeto, nomeDeArquivo } from './arquivosNavegador';

export { EXTENSAO, mensagemDeErro } from './arquivosNavegador';

export const textosArquivos = {
  filtroProjeto: 'Projeto do Investigando',
  filtroPng: 'Imagem PNG',
  tituloAbrir: 'Abrir projeto',
  tituloSalvar: 'Salvar projeto',
  tituloExportarPng: 'Exportar gráfico como imagem',
  alteracoesNaoSalvas: 'Há alterações não salvas. Deseja sair sem salvar?',
  abrirSemSalvar: 'Há alterações não salvas. Abrir outro projeto mesmo assim?',
  erroExportar: 'Não consegui exportar o gráfico.',
};

export interface ProjetoAberto {
  projeto: Projeto;
  /** Caminho no disco (só no app nativo). */
  caminho?: string;
}
export type FonteImagem = SVGSVGElement | Blob;
export interface ResultadoSalvar {
  nome: string;
  caminho?: string;
}

/** Operações de baixo nível do app nativo (Tauri). Separadas para poderem ser trocadas em testes. */
export interface PonteNativa {
  escolherAbrir(): Promise<{ texto: string; caminho: string } | null>;
  escolherSalvar(nomeSugerido: string, filtro: { nome: string; extensao: string }): Promise<string | null>;
  escreverTexto(caminho: string, texto: string): Promise<void>;
  escreverBinario(caminho: string, bytes: Uint8Array): Promise<void>;
  confirmar(mensagem: string, rotuloOk?: string): Promise<boolean>;
  /** Lê um arquivo de texto pelo caminho (liberado pelo app ao receber o arquivo aberto pelo sistema). */
  lerTexto(caminho: string): Promise<string>;
  /** Escuta arquivos abertos pelo sistema (duplo clique/arrastar no ícone), inclusive os que chegaram antes. */
  aoAbrirExterno(tratar: (caminho: string) => void): Promise<() => void>;
  /** Intercepta o pedido de fechar a janela; `podeFechar` devolve true para fechar de fato. */
  aoFechar(podeFechar: () => Promise<boolean>): Promise<() => void>;
}

export interface Arquivos {
  nativo: boolean;
  /** Abre pelo diálogo nativo. No navegador devolve null: use `abrirArquivo` com o arquivo do <input>. */
  abrir(): Promise<ProjetoAberto | null>;
  abrirArquivo(arquivo: File): Promise<ProjetoAberto>;
  /** Salva em `caminho` se existir; senão pergunta onde (nativo) ou baixa (navegador). null = cancelado. */
  salvar(texto: string, titulo: string, caminho?: string): Promise<ResultadoSalvar | null>;
  salvarComo(texto: string, titulo: string): Promise<ResultadoSalvar | null>;
  /** `fonte` é um SVG ou um PNG já pronto (Blob), como o do gráfico desenhado em canvas. */
  exportarPng(fonte: FonteImagem, nomeBase: string): Promise<string | null>;
  exportarPdf(fonte: FonteImagem, titulo: string): Promise<void>;
  imprimirMesa(): void;
  /**
   * Escuta projetos abertos pelo sistema (duplo clique no Finder, arrastar sobre o ícone, argumento de linha de comando).
   * Valida como o "Abrir" e, havendo alterações não salvas, confirma antes de trocar. No navegador não faz nada.
   */
  escutarAberturaExterna(opcoes: {
    temAlteracoes: () => boolean;
    aoAbrir: (aberto: ProjetoAberto) => void;
    aoErro: (erro: unknown) => void;
  }): Promise<() => void>;
  /** Registra aviso de alterações não salvas ao fechar. `temAlteracoes` é consultado na hora de fechar. */
  protegerFechamento(temAlteracoes: () => boolean): Promise<() => void>;
}

export function ehTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function nomeDoCaminho(caminho: string): string {
  return caminho.split(/[\\/]/).pop() || caminho;
}

function serializarSvg(svg: SVGSVGElement): { texto: string; largura: number; altura: number } {
  const caixa = svg.viewBox.baseVal;
  const largura = Math.round(svg.width.baseVal.value || caixa?.width || svg.getBoundingClientRect().width || 600);
  const altura = Math.round(svg.height.baseVal.value || caixa?.height || svg.getBoundingClientRect().height || 400);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(largura));
  clone.setAttribute('height', String(altura));
  return { texto: new XMLSerializer().serializeToString(clone), largura, altura };
}

async function svgParaPng(svg: SVGSVGElement, escala = 2): Promise<Uint8Array> {
  const { texto, largura, altura } = serializarSvg(svg);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error(textosArquivos.erroExportar));
      img.src = url;
    });
    const tela = document.createElement('canvas');
    tela.width = largura * escala;
    tela.height = altura * escala;
    const ctx = tela.getContext('2d');
    if (!ctx) throw new Error(textosArquivos.erroExportar);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.drawImage(img, 0, 0, tela.width, tela.height);
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/png'));
    if (!blob) throw new Error(textosArquivos.erroExportar);
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

function baixarBytes(bytes: Uint8Array, nome: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function blobParaDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/png'};base64,${btoa(bin)}`;
}

async function imprimirSvg(fonte: FonteImagem, titulo: string): Promise<void> {
  const texto = fonte instanceof Blob
    ? `<img alt="" src="${await blobParaDataUrl(fonte)}">`
    : serializarSvg(fonte).texto;
  const quadro = document.createElement('iframe');
  quadro.setAttribute('aria-hidden', 'true');
  quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(quadro);
  const doc = quadro.contentDocument;
  const janela = quadro.contentWindow;
  if (!doc || !janela) {
    quadro.remove();
    return Promise.reject(new Error(textosArquivos.erroExportar));
  }
  const esc = titulo.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc}</title><style>body{margin:0}svg,img{max-width:100%;height:auto}</style></head><body>${texto}</body></html>`);
  doc.close();
  janela.focus();
  janela.print();
  setTimeout(() => quadro.remove(), 1000);
  return Promise.resolve();
}

export function criarArquivos(opcoes: { nativo?: PonteNativa | null } = {}): Arquivos {
  const ponte = opcoes.nativo ?? null;
  const filtroProjeto = { nome: textosArquivos.filtroProjeto, extensao: EXTENSAO.slice(1) };

  async function gravarNoCaminho(texto: string, caminho: string): Promise<ResultadoSalvar> {
    await ponte!.escreverTexto(caminho, texto);
    return { nome: nomeDoCaminho(caminho), caminho };
  }

  const salvarComo: Arquivos['salvarComo'] = async (texto, titulo) => {
    if (!ponte) return { nome: baixarProjeto(texto, titulo) };
    const caminho = await ponte.escolherSalvar(nomeDeArquivo(titulo), filtroProjeto);
    return caminho ? gravarNoCaminho(texto, caminho) : null;
  };

  return {
    nativo: ponte !== null,
    async abrir() {
      if (!ponte) return null;
      const escolhido = await ponte.escolherAbrir();
      if (!escolhido) return null;
      return { projeto: abrirProjeto(escolhido.texto), caminho: escolhido.caminho };
    },
    async abrirArquivo(arquivo) {
      return { projeto: await lerArquivoProjeto(arquivo) };
    },
    async salvar(texto, titulo, caminho) {
      if (ponte && caminho) return gravarNoCaminho(texto, caminho);
      return salvarComo(texto, titulo);
    },
    salvarComo,
    async exportarPng(fonte, nomeBase) {
      const bytes = fonte instanceof Blob ? new Uint8Array(await fonte.arrayBuffer()) : await svgParaPng(fonte);
      const nome = `${nomeBase}.png`;
      if (!ponte) {
        baixarBytes(bytes, nome, 'image/png');
        return nome;
      }
      const caminho = await ponte.escolherSalvar(nome, { nome: textosArquivos.filtroPng, extensao: 'png' });
      if (!caminho) return null;
      await ponte.escreverBinario(caminho, bytes);
      return nomeDoCaminho(caminho);
    },
    // PDF = diálogo de impressão do sistema ("Salvar como PDF"), igual no navegador e no app.
    exportarPdf: imprimirSvg,
    imprimirMesa() {
      window.print();
    },
    async escutarAberturaExterna({ temAlteracoes, aoAbrir, aoErro }) {
      if (!ponte) return () => undefined;
      return ponte.aoAbrirExterno(async (caminho) => {
        try {
          if (temAlteracoes() && !(await ponte.confirmar(textosArquivos.abrirSemSalvar, 'Abrir sem salvar'))) return;
          const texto = await ponte.lerTexto(caminho);
          aoAbrir({ projeto: abrirProjeto(texto), caminho });
        } catch (erro) {
          aoErro(erro);
        }
      });
    },
    async protegerFechamento(temAlteracoes) {
      if (ponte) {
        return ponte.aoFechar(async () => !temAlteracoes() || ponte.confirmar(textosArquivos.alteracoesNaoSalvas));
      }
      const aviso = (e: BeforeUnloadEvent) => {
        if (!temAlteracoes()) return;
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', aviso);
      return () => window.removeEventListener('beforeunload', aviso);
    },
  };
}

/** Ponte real com Tauri. Importa os plugins só quando o app roda dentro do Tauri. */
async function carregarPonteTauri(): Promise<PonteNativa> {
  const dialogo = await import('@tauri-apps/plugin-dialog');
  const fs = await import('@tauri-apps/plugin-fs');
  const janela = await import('@tauri-apps/api/window');
  return {
    async escolherAbrir() {
      const caminho = await dialogo.open({
        title: textosArquivos.tituloAbrir,
        multiple: false,
        directory: false,
        filters: [{ name: textosArquivos.filtroProjeto, extensions: [EXTENSAO.slice(1), 'json'] }],
      });
      if (typeof caminho !== 'string') return null;
      return { texto: await fs.readTextFile(caminho), caminho };
    },
    async escolherSalvar(nomeSugerido, filtro) {
      const ext = filtro.extensao;
      const caminho = await dialogo.save({
        title: ext === 'png' ? textosArquivos.tituloExportarPng : textosArquivos.tituloSalvar,
        defaultPath: nomeSugerido,
        filters: [{ name: filtro.nome, extensions: [ext] }],
      });
      if (!caminho) return null;
      return caminho.toLowerCase().endsWith(`.${ext}`) ? caminho : `${caminho}.${ext}`;
    },
    escreverTexto: (caminho, texto) => fs.writeTextFile(caminho, texto),
    escreverBinario: (caminho, bytes) => fs.writeFile(caminho, bytes),
    confirmar: (mensagem, rotuloOk = 'Sair sem salvar') => dialogo.ask(mensagem, { kind: 'warning', okLabel: rotuloOk, cancelLabel: 'Cancelar' }),
    lerTexto: (caminho) => fs.readTextFile(caminho),
    async aoAbrirExterno(tratar) {
      const evento = await import('@tauri-apps/api/event');
      const nucleo = await import('@tauri-apps/api/core');
      const desfazer = await evento.listen<string>('abrir-arquivo', (e) => tratar(e.payload));
      // Avisa o Rust que já escutamos e recebe o que chegou antes (app aberto pelo duplo clique).
      const antes = await nucleo.invoke<string[]>('interface_pronta');
      antes.forEach(tratar);
      return desfazer;
    },
    aoFechar(podeFechar) {
      const atual = janela.getCurrentWindow();
      return atual.onCloseRequested(async (evento) => {
        evento.preventDefault();
        if (await podeFechar()) await atual.destroy();
      });
    },
  };
}

/** Ponte que só carrega os plugins do Tauri no primeiro uso. */
export function criarPonteTauri(carregar: () => Promise<PonteNativa> = carregarPonteTauri): PonteNativa {
  let ponte: Promise<PonteNativa> | null = null;
  const p = () => (ponte ??= carregar());
  return {
    escolherAbrir: async () => (await p()).escolherAbrir(),
    escolherSalvar: async (nome, filtro) => (await p()).escolherSalvar(nome, filtro),
    escreverTexto: async (c, t) => (await p()).escreverTexto(c, t),
    escreverBinario: async (c, b) => (await p()).escreverBinario(c, b),
    confirmar: async (m, ok) => (await p()).confirmar(m, ok),
    lerTexto: async (c) => (await p()).lerTexto(c),
    aoAbrirExterno: async (t) => (await p()).aoAbrirExterno(t),
    aoFechar: async (f) => (await p()).aoFechar(f),
  };
}

let instancia: Arquivos | null = null;
/** Instância do app: nativa dentro do Tauri, do navegador fora dele. */
export function obterArquivos(): Arquivos {
  instancia ??= criarArquivos({ nativo: ehTauri() ? criarPonteTauri() : null });
  return instancia;
}
