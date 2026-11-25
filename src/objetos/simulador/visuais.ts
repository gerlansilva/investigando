// Geometria dos desenhos (funções puras, testáveis sem DOM).
import type { Bola, Setor } from '../../simulador';

export interface SorteioVisual {
  /** Aumenta a cada repetição: dispara a animação. */
  serial: number;
  /** Último item sorteado na repetição. */
  indice: number;
  nome: string;
  /** Todos os nomes sorteados na repetição. */
  itens: string[];
}

export interface FatiaSetor {
  indice: number;
  inicio: number;
  fim: number;
  meio: number;
  fracao: number;
}

/** Ângulos em graus, no sentido horário a partir do topo. */
export function fatiasDaRoleta(setores: readonly Pick<Setor, 'proporcao'>[]): FatiaSetor[] {
  const validos = setores.map((s) => (Number.isFinite(s.proporcao) && s.proporcao > 0 ? s.proporcao : 0));
  const total = validos.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  let acumulado = 0;
  return validos.map((p, indice) => {
    const inicio = (acumulado / total) * 360;
    acumulado += p;
    const fim = (acumulado / total) * 360;
    return { indice, inicio, fim, meio: (inicio + fim) / 2, fracao: p / total };
  });
}

export function ponto(cx: number, cy: number, raio: number, graus: number): { x: number; y: number } {
  const rad = (graus * Math.PI) / 180;
  return { x: cx + raio * Math.sin(rad), y: cy - raio * Math.cos(rad) };
}

export function caminhoDaFatia(cx: number, cy: number, raio: number, inicio: number, fim: number): string {
  const a = ponto(cx, cy, raio, inicio);
  const b = ponto(cx, cy, raio, fim);
  const grande = fim - inicio > 180 ? 1 : 0;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M ${cx} ${cy} L ${f(a.x)} ${f(a.y)} A ${raio} ${raio} 0 ${grande} 1 ${f(b.x)} ${f(b.y)} Z`;
}

/** Quantas bolinhas desenhar de cada tipo (no máximo `limite` no total, pelo menos 1 de cada tipo que couber). */
export function bolinhasPorTipo(bolas: readonly Pick<Bola, 'quantidade'>[], limite = 24): number[] {
  const tipos = bolas.slice(0, limite);
  const validos = tipos.map((b) => (Number.isFinite(b.quantidade) && b.quantidade > 0 ? Math.floor(b.quantidade) : 0));
  const total = validos.reduce((a, b) => a + b, 0);
  if (total === 0) return validos.map(() => 0);
  if (total <= limite) return validos;
  const resto = limite - tipos.length;
  const base = validos.map((q) => (q > 0 ? 1 : 0));
  const cotas = validos.map((q) => (q / total) * resto);
  const contagem = base.map((b, i) => b + Math.floor(cotas[i]!));
  let faltam = limite - contagem.reduce((a, b) => a + b, 0);
  const ordem = cotas.map((c, i) => ({ i, f: c - Math.floor(c) })).sort((a, b) => b.f - a.f);
  for (const { i } of ordem) {
    if (faltam <= 0) break;
    if (validos[i]! > 0) {
      contagem[i] = contagem[i]! + 1;
      faltam -= 1;
    }
  }
  return contagem;
}
