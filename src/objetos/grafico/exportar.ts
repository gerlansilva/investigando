// Exportar o gráfico como PNG: redesenha pontos (canvas) e eixos/rótulos (cena vetorial) num canvas fora da tela.
import type { Colecao } from '../../modelo/tipos';
import { calcularCores } from './cores';
import { construirCena, LARGURA_LEGENDA, primitivasDaLegenda, type Primitiva } from './cena';
import { desenharPontos, desenharPrimitivas } from './desenho';
import type { EstadoGrafico } from './estado';
import { areaInterna, calcularMargem, prepararLayout } from './layout';
import { textos } from './textos';

export interface CanvasExportacao {
  width: number;
  height: number;
  getContext(tipo: '2d'): CanvasRenderingContext2D | null;
  toBlob?(retorno: (blob: Blob | null) => void, tipo?: string): void;
  convertToBlob?(opcoes?: { type?: string }): Promise<Blob>;
}

export interface OpcoesExportar {
  /** Tamanho do gráfico (área dos pontos + margens), em pixels CSS. */
  largura: number;
  altura: number;
  /** Casos selecionados, para desenhar o anel de destaque. */
  selecao?: ReadonlySet<string>;
  /** Fator de resolução (padrão 2, nítido em telas retina e na impressão). */
  escala?: number;
  globais?: Record<string, number>;
  /** Para testes ou ambientes sem DOM. */
  criarCanvas?: (largura: number, altura: number) => CanvasExportacao;
}

function canvasPadrao(largura: number, altura: number): CanvasExportacao {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = largura;
    c.height = altura;
    return c;
  }
  return new OffscreenCanvas(largura, altura) as unknown as CanvasExportacao;
}

export interface CenaExportada {
  largura: number;
  altura: number;
  margem: { esq: number; sup: number };
  vetores: Primitiva[];
  posicoes: Float32Array;
  cores: string[];
  diametro: number;
  indicesSelecionados: Set<number>;
}

/** Parte lógica da exportação (sem canvas): o que será desenhado e onde. */
export function prepararExportacao(estado: EstadoGrafico, colecao: Colecao | undefined, o: OpcoesExportar): CenaExportada {
  const margem = calcularMargem(estado, colecao);
  const area = areaInterna(o.largura, o.altura, margem);
  const layout = prepararLayout({ estado, colecao, largura: area.largura, altura: area.altura, globais: o.globais });
  const { cores, legenda } = calcularCores(colecao, layout.casos, estado.corPor);
  const vetores = construirCena(layout, estado, margem);
  const larguraTotal = o.largura + (legenda ? LARGURA_LEGENDA : 0);
  if (legenda) vetores.push(...primitivasDaLegenda(legenda, o.largura + 8, margem.sup));
  const indicesSelecionados = new Set<number>();
  if (o.selecao) layout.ids.forEach((id, i) => o.selecao!.has(id) && indicesSelecionados.add(i));
  return {
    largura: larguraTotal,
    altura: o.altura,
    margem: { esq: margem.esq, sup: margem.sup },
    vetores,
    posicoes: layout.alvo,
    cores,
    diametro: layout.diametro,
    indicesSelecionados,
  };
}

export async function exportarPng(estado: EstadoGrafico, colecao: Colecao | undefined, opcoes: OpcoesExportar): Promise<Blob> {
  const escala = opcoes.escala ?? 2;
  const cena = prepararExportacao(estado, colecao, opcoes);
  const canvas = (opcoes.criarCanvas ?? canvasPadrao)(Math.round(cena.largura * escala), Math.round(cena.altura * escala));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(textos.salvarImagemErro);
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cena.largura, cena.altura);
  ctx.save();
  ctx.translate(cena.margem.esq, cena.margem.sup);
  desenharPontos(ctx, {
    posicoes: cena.posicoes,
    n: cena.cores.length,
    cores: cena.cores,
    diametro: cena.diametro,
    forma: estado.icone.forma,
    selecionados: cena.indicesSelecionados,
  });
  ctx.restore();
  desenharPrimitivas(ctx, cena.vetores.filter((p) => p.papel !== 'legenda'), cena.margem.esq, cena.margem.sup);
  desenharPrimitivas(ctx, cena.vetores.filter((p) => p.papel === 'legenda'), 0, 0);
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    if (canvas.convertToBlob) canvas.convertToBlob({ type: 'image/png' }).then(resolve, reject);
    else if (canvas.toBlob) canvas.toBlob(resolve, 'image/png');
    else resolve(null);
  });
  if (!blob) throw new Error(textos.salvarImagemErro);
  return blob;
}

/** Baixa o Blob como arquivo (no navegador). */
export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
