// Animação dos pontos: funções puras (sem DOM). O laço de requestAnimationFrame fica em Grafico.tsx.

export const DURACAO_PADRAO_MS = 500;
export const DURACAO_MIN_MS = 400;
export const DURACAO_MAX_MS = 600;
/** Acima disso os pontos pulam direto para o alvo (sem interpolar). */
export const LIMITE_PONTOS_ANIMADOS = 10000;

export function limitarDuracao(ms: number): number {
  return Math.min(DURACAO_MAX_MS, Math.max(DURACAO_MIN_MS, ms));
}

/** Desaceleração cúbica: começa rápido e termina suave. facilidade(0)=0, facilidade(1)=1. */
export function facilidade(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function progresso(decorridoMs: number, duracaoMs: number): number {
  if (!(duracaoMs > 0)) return 1;
  return Math.min(1, Math.max(0, decorridoMs / duracaoMs));
}

export function deveAnimar(quantidade: number, movimentoReduzido: boolean): boolean {
  return !movimentoReduzido && quantidade <= LIMITE_PONTOS_ANIMADOS;
}

/**
 * Um passo: escreve em `atual` a interpolação entre `origem` e `alvo` (arrays [x0, y0, x1, y1, ...]).
 * `t` em [0, 1] é o progresso linear; a suavização é aplicada aqui. Devolve true quando terminou
 * (t >= 1), caso em que `atual` é exatamente igual a `alvo`.
 */
export function passoAnimacao(
  origem: Float32Array,
  alvo: Float32Array,
  atual: Float32Array,
  t: number,
  suavizar: (t: number) => number = facilidade,
): boolean {
  const n = Math.min(origem.length, alvo.length, atual.length);
  if (t >= 1) {
    for (let i = 0; i < n; i++) atual[i] = alvo[i]!;
    return true;
  }
  const k = suavizar(t);
  for (let i = 0; i < n; i++) {
    const o = origem[i]!;
    atual[i] = o + (alvo[i]! - o) * k;
  }
  return false;
}

/** Diz se algum ponto ainda está fora do alvo (tolerância em pixels). */
export function emMovimento(atual: Float32Array, alvo: Float32Array, tolerancia = 0.01): boolean {
  const n = Math.min(atual.length, alvo.length);
  for (let i = 0; i < n; i++) if (Math.abs(atual[i]! - alvo[i]!) > tolerancia) return true;
  return false;
}

/**
 * Posição de partida de cada caso da nova lista: onde ele está agora (se já estava no gráfico) ou,
 * se for novo, `padrao` (índice a índice, mesmo formato [x, y, ...]).
 */
export function origemParaNovaLista(
  idsAntigos: readonly string[],
  atualAntigo: Float32Array,
  idsNovos: readonly string[],
  padrao: Float32Array,
): Float32Array {
  const indice = new Map<string, number>();
  idsAntigos.forEach((id, i) => indice.set(id, i));
  const saida = new Float32Array(idsNovos.length * 2);
  for (let i = 0; i < idsNovos.length; i++) {
    const j = indice.get(idsNovos[i]!);
    if (j === undefined) {
      saida[2 * i] = padrao[2 * i]!;
      saida[2 * i + 1] = padrao[2 * i + 1]!;
    } else {
      saida[2 * i] = atualAntigo[2 * j]!;
      saida[2 * i + 1] = atualAntigo[2 * j + 1]!;
    }
  }
  return saida;
}
