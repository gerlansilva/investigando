import { useEffect, useRef } from 'react';
import { t } from '../../i18n/pt-BR';
import type { Setor } from '../../simulador';
import { prefereMenosMovimento, suavizarSaida } from './movimento';
import { caminhoDaFatia, fatiasDaRoleta, ponto, type SorteioVisual } from './visuais';

interface Props {
  setores: Setor[];
  sorteio: SorteioVisual | null;
  /** Duração do giro em ms; 0 = sem animação. */
  duracao: number;
  descricao: string;
  /** Clique no dispositivo: sorteia uma vez. */
  aoClicar?: () => void;
}

/** Escolhe tinta ou branco para o texto sobre uma cor, pelo maior contraste. */
function corDoTexto(cor: string | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((cor ?? '').trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1]!, 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (1.05) / (l + 0.05) >= (l + 0.05) / 0.012 ? '#ffffff' : '#1b1747';
}

const C = 100;
const R = 90;

function agendarQuadro(f: (agora: number) => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(() => f(Date.now()), 16);
  return () => clearTimeout(id);
}

export function Roleta({ setores, sorteio, duracao, descricao, aoClicar }: Props) {
  const ponteiro = useRef<SVGGElement>(null);
  const angulo = useRef(0);
  const fatias = fatiasDaRoleta(setores);

  useEffect(() => {
    if (!sorteio) return;
    const fatia = fatiasDaRoleta(setores)[sorteio.indice];
    if (!fatia) return;
    const alvo = fatia.meio;
    const definir = (graus: number) => {
      const g = ponteiro.current;
      if (!g) return;
      angulo.current = ((graus % 360) + 360) % 360;
      g.setAttribute('transform', `rotate(${graus} ${C} ${C})`);
      g.setAttribute('data-angulo', String(Math.round(angulo.current * 100) / 100));
      g.setAttribute('data-setor', String(sorteio.indice));
    };
    if (duracao <= 0 || prefereMenosMovimento()) {
      definir(alvo);
      return;
    }
    const inicio = angulo.current;
    const percurso = ((((alvo - inicio) % 360) + 360) % 360) + 360 * 3;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let cancelar = () => {};
    const quadro = (agora: number) => {
      const p = (agora - t0) / duracao;
      if (p >= 1) {
        definir(alvo);
        return;
      }
      definir(inicio + percurso * suavizarSaida(p));
      cancelar = agendarQuadro(quadro);
    };
    cancelar = agendarQuadro(quadro);
    return () => cancelar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorteio?.serial]);

  return (
    <svg className="simulador-roleta" data-clicavel={aoClicar ? '' : undefined} onClick={aoClicar} viewBox="0 0 200 200" role="img" aria-label={t.simulador.roletaAria(descricao)}>
      {fatias.length === 1 ? (
        <circle className="simulador-roleta__fatia" cx={C} cy={C} r={R} fill={setores[0]?.cor} data-setor={0} />
      ) : (
        fatias.map((f) => (
          <path
            key={f.indice}
            d={caminhoDaFatia(C, C, R, f.inicio, f.fim)}
            className="simulador-roleta__fatia"
            fill={setores[f.indice]?.cor}
            data-setor={f.indice}
          />
        ))
      )}
      {fatias
        .filter((f) => f.fim - f.inicio >= 24)
        .map((f) => {
          const p = ponto(C, C, R * 0.62, f.meio);
          return (
            <text key={f.indice} className="simulador-roleta__rotulo" x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" aria-hidden="true" style={{ fill: corDoTexto(setores[f.indice]?.cor) }}>
              {setores[f.indice]?.nome}
            </text>
          );
        })}
      <g ref={ponteiro} className="simulador-roleta__ponteiro" aria-hidden="true" data-angulo="0">
        <polygon points={`${C},${C - R - 4} ${C - 7},${C} ${C + 7},${C}`} />
        <circle cx={C} cy={C} r={9} />
      </g>
    </svg>
  );
}
