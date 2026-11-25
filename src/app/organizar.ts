import type { ObjetoMesa } from '../modelo/tipos';

/** Distância das bordas da mesa e entre quadros. */
export const MARGEM_MESA = 24;
export const FOLGA_ENTRE_QUADROS = 16;
const PASSO = 8;
const LIMITE_VERTICAL = 6000;

export interface Caixa {
  x: number;
  y: number;
  l: number;
  a: number;
}

function sobrepoe(a: Caixa, b: Caixa, folga: number): boolean {
  return a.x < b.x + b.l + folga && a.x + a.l + folga > b.x && a.y < b.y + b.a + folga && a.y + a.a + folga > b.y;
}

/**
 * Primeiro lugar livre, lendo a mesa da esquerda para a direita e de cima para baixo.
 * O quadro novo nunca fica sobre os que já estão lá.
 */
export function posicaoLivre(ocupados: readonly Caixa[], l: number, a: number, larguraMesa: number): { x: number; y: number } {
  const maxX = Math.max(MARGEM_MESA, larguraMesa - l - MARGEM_MESA);
  for (let y = MARGEM_MESA; y <= LIMITE_VERTICAL; y += PASSO) {
    for (let x = MARGEM_MESA; x <= maxX; x += PASSO) {
      const candidato = { x, y, l, a };
      if (!ocupados.some((o) => sobrepoe(candidato, o, FOLGA_ENTRE_QUADROS))) return { x, y };
    }
  }
  const abaixo = ocupados.reduce((m, o) => Math.max(m, o.y + o.a), 0);
  return { x: MARGEM_MESA, y: abaixo + FOLGA_ENTRE_QUADROS };
}

/** Arruma os quadros em fileiras, na ordem em que aparecem hoje (de cima para baixo, da esquerda para a direita). */
export function organizarEmFileiras(objetos: readonly Pick<ObjetoMesa, 'id' | 'x' | 'y' | 'l' | 'a'>[], larguraMesa: number): Map<string, { x: number; y: number }> {
  const ordem = [...objetos].sort((p, q) => Math.round(p.y / 40) - Math.round(q.y / 40) || p.x - q.x);
  const posicoes = new Map<string, { x: number; y: number }>();
  let x = MARGEM_MESA;
  let y = MARGEM_MESA;
  let alturaDaFileira = 0;
  for (const o of ordem) {
    if (x > MARGEM_MESA && x + o.l > larguraMesa - MARGEM_MESA) {
      x = MARGEM_MESA;
      y += alturaDaFileira + FOLGA_ENTRE_QUADROS;
      alturaDaFileira = 0;
    }
    posicoes.set(o.id, { x, y });
    x += o.l + FOLGA_ENTRE_QUADROS;
    alturaDaFileira = Math.max(alturaDaFileira, o.a);
  }
  return posicoes;
}
