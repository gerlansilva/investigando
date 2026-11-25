// Desenho em canvas 2D (pontos e primitivas vetoriais). Usado na tela e na exportação.
import type { FormaIcone } from './estado';
import { acrescentarForma } from './formas';
import type { Primitiva } from './cena';

export const COR_ANEL = '#111111';

export interface OpcoesPontos {
  /** [x0, y0, x1, y1, ...] */
  posicoes: Float32Array;
  n: number;
  cores: readonly string[];
  diametro: number;
  forma: FormaIcone;
  /** Forma de cada ponto (se omitida, todos usam `forma`). */
  formas?: readonly FormaIcone[];
  /** Índices (na ordem dos pontos) dos casos selecionados. */
  selecionados?: ReadonlySet<number>;
}

function caminho(ctx: CanvasRenderingContext2D, forma: FormaIcone, x: number, y: number, r: number): void {
  if (forma === 'quadrado') ctx.rect(x - r, y - r, 2 * r, 2 * r);
  else acrescentarForma(ctx, forma, x, y, r);
}

/** Desenha os pontos (sem limpar o canvas). Pontos de mesma cor são agrupados num só traçado. */
export function desenharPontos(ctx: CanvasRenderingContext2D, o: OpcoesPontos): void {
  const r = Math.max(1, o.diametro / 2);
  const sel = o.selecionados;
  const temSelecao = !!sel && sel.size > 0;
  const grupos = new Map<string, number[]>();
  for (let i = 0; i < o.n; i++) {
    if (temSelecao && sel!.has(i)) continue;
    const cor = o.cores[i] ?? '#2a6fdb';
    const chave = o.formas ? `${cor}|${o.formas[i] ?? o.forma}` : cor;
    const g = grupos.get(chave);
    if (g) g.push(i);
    else grupos.set(chave, [i]);
  }
  const contorno = o.n <= 3000;
  ctx.save();
  ctx.globalAlpha = temSelecao ? 0.4 : 0.88;
  for (const [chave, idx] of grupos) {
    const cor = o.formas ? chave.slice(0, chave.lastIndexOf('|')) : chave;
    ctx.beginPath();
    for (const i of idx) caminho(ctx, o.formas?.[i] ?? o.forma, o.posicoes[2 * i]!, o.posicoes[2 * i + 1]!, r);
    ctx.fillStyle = cor;
    ctx.fill();
    if (contorno) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
    }
  }
  ctx.restore();
  if (temSelecao) {
    ctx.save();
    for (const i of sel!) {
      if (i < 0 || i >= o.n) continue;
      const x = o.posicoes[2 * i]!;
      const y = o.posicoes[2 * i + 1]!;
      ctx.beginPath();
      caminho(ctx, o.formas?.[i] ?? o.forma, x, y, r);
      ctx.fillStyle = o.cores[i] ?? '#2a6fdb';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.beginPath();
      caminho(ctx, o.formas?.[i] ?? o.forma, x, y, r + 3);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COR_ANEL;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export const FONTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function desenharPrimitivas(ctx: CanvasRenderingContext2D, prims: readonly Primitiva[], dx = 0, dy = 0): void {
  ctx.save();
  ctx.translate(dx, dy);
  for (const p of prims) {
    if (p.tipo === 'linha') {
      ctx.beginPath();
      ctx.setLineDash(p.tracejado ?? []);
      ctx.lineWidth = p.largura;
      ctx.strokeStyle = p.cor;
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (p.tipo === 'retangulo') {
      ctx.fillStyle = p.preenchimento;
      ctx.fillRect(p.x, p.y, p.l, p.a);
      if (p.contorno) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = p.contorno;
        ctx.strokeRect(p.x, p.y, p.l, p.a);
      }
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotacao) ctx.rotate((p.rotacao * Math.PI) / 180);
      ctx.font = `${p.negrito ? 'bold ' : ''}${p.tamanho}px ${FONTE}`;
      ctx.textAlign = p.ancora === 'middle' ? 'center' : p.ancora === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      if (p.halo) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeText(p.texto, 0, 0);
      }
      ctx.fillStyle = p.cor;
      ctx.fillText(p.texto, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}
