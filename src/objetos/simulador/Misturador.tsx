import { useEffect, useMemo, useRef } from 'react';
import { t } from '../../i18n/pt-BR';
import type { Bola } from '../../simulador';
import { prefereMenosMovimento } from './movimento';
import { bolinhasPorTipo, type SorteioVisual } from './visuais';

interface Props {
  bolas: Bola[];
  sorteio: SorteioVisual | null;
  duracao: number;
  descricao: string;
  /** Clique no dispositivo: sorteia uma vez. */
  aoClicar?: () => void;
}

interface Bolinha {
  tipo: number;
  cor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const ESQ = 26;
const DIR = 174;
const TOPO = 56;
const BASE = 186;
const RAIO = 11;
const BOCA = { x: 100, y: 30 };

/** Sorteador simples só para a posição das bolinhas (decorativo, não afeta os resultados). */
function pseudo(semente: number): () => number {
  let s = semente >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function criarBolinhas(bolas: Bola[]): Bolinha[] {
  const sorte = pseudo(7);
  const contagem = bolinhasPorTipo(bolas);
  const lista: Bolinha[] = [];
  contagem.forEach((n, tipo) => {
    for (let i = 0; i < n; i++) {
      lista.push({
        tipo,
        cor: bolas[tipo]!.cor,
        x: ESQ + RAIO + sorte() * (DIR - ESQ - 2 * RAIO),
        y: TOPO + RAIO + sorte() * (BASE - TOPO - 2 * RAIO),
        vx: (sorte() - 0.5) * 2,
        vy: (sorte() - 0.5) * 2,
      });
    }
  });
  return lista;
}

export function Misturador({ bolas, sorteio, duracao, descricao, aoClicar }: Props) {
  const chave = JSON.stringify(bolas.map((b) => [b.quantidade, b.cor]));
  // `fixas` são as posições iniciais desenhadas pelo React (nunca mudam); `bolinhas` é a cópia que a animação move.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fixas = useMemo(() => criarBolinhas(bolas), [chave]);
  const bolinhas = useMemo(() => fixas.map((b) => ({ ...b })), [fixas]);
  const circulos = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    const desenhar = (b: Bolinha, i: number, x = b.x, y = b.y) => {
      const c = circulos.current[i];
      if (!c) return;
      c.setAttribute('cx', String(Math.round(x * 10) / 10));
      c.setAttribute('cy', String(Math.round(y * 10) / 10));
    };
    const escolhida = sorteio ? bolinhas.findIndex((b) => b.tipo === sorteio.indice) : -1;
    const estatico = duracao <= 0 || prefereMenosMovimento() || !sorteio;
    bolinhas.forEach((b, i) => circulos.current[i]?.setAttribute('data-saiu', i === escolhida && sorteio ? 'sim' : 'nao'));
    if (estatico) {
      bolinhas.forEach((b, i) => (i === escolhida ? desenhar(b, i, BOCA.x, BOCA.y) : desenhar(b, i)));
      return;
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let id = 0;
    let anterior = t0;
    const quadro = (agora: number) => {
      const p = Math.min(1, (agora - t0) / duracao);
      const passo = Math.min(2, (agora - anterior) / 16);
      anterior = agora;
      bolinhas.forEach((b, i) => {
        if (i === escolhida && p > 0.7) {
          const k = (p - 0.7) / 0.3;
          desenhar(b, i, b.x + (BOCA.x - b.x) * k, b.y + (BOCA.y - b.y) * k);
          return;
        }
        const forca = 3 * (1 - p * 0.5);
        b.x += b.vx * forca * passo;
        b.y += b.vy * forca * passo;
        if (b.x < ESQ + RAIO || b.x > DIR - RAIO) {
          b.vx = -b.vx;
          b.x = Math.min(DIR - RAIO, Math.max(ESQ + RAIO, b.x));
        }
        if (b.y < TOPO + RAIO || b.y > BASE - RAIO) {
          b.vy = -b.vy;
          b.y = Math.min(BASE - RAIO, Math.max(TOPO + RAIO, b.y));
        }
        desenhar(b, i);
      });
      if (p < 1) id = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(quadro) : (setTimeout(() => quadro(Date.now()), 16) as unknown as number);
      else if (escolhida >= 0) desenhar(bolinhas[escolhida]!, escolhida, BOCA.x, BOCA.y);
    };
    id = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(quadro) : (setTimeout(() => quadro(Date.now()), 16) as unknown as number);
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
      else clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorteio?.serial, bolinhas]);

  return (
    <svg className="simulador-misturador" data-clicavel={aoClicar ? '' : undefined} onClick={aoClicar} viewBox="0 0 200 200" role="img" aria-label={t.simulador.misturadorAria(descricao)}>
      <path className="simulador-misturador__pote" d={`M ${ESQ} ${TOPO - 6} L ${ESQ} ${BASE + 4} L ${DIR} ${BASE + 4} L ${DIR} ${TOPO - 6}`} fill="none" strokeWidth={4} />
      <rect className="simulador-misturador__boca" x={BOCA.x - 16} y={BOCA.y - 16} width={32} height={32} rx={8} fill="none" strokeWidth={2} strokeDasharray="4 3" />
      {fixas.map((b, i) => (
        <circle
          key={i}
          ref={(el) => {
            circulos.current[i] = el;
          }}
          className="simulador-misturador__bola"
          cx={b.x}
          cy={b.y}
          r={RAIO}
          fill={b.cor}
        />
      ))}
    </svg>
  );
}
