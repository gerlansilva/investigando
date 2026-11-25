// Grade espacial simples para hit-testing de pontos (sem DOM).

export interface GradeEspacial {
  tamanhoCelula: number;
  colunas: number;
  linhas: number;
  /** início de cada célula em `itens` (CSR); tamanho colunas*linhas + 1 */
  inicios: Int32Array;
  itens: Int32Array;
  xs: Float32Array;
  ys: Float32Array;
  n: number;
}

/** `posicoes` no formato [x0, y0, x1, y1, ...]. */
export function construirGrade(posicoes: Float32Array, n: number, largura: number, altura: number, tamanhoCelula = 24): GradeEspacial {
  const colunas = Math.max(1, Math.ceil(largura / tamanhoCelula));
  const linhas = Math.max(1, Math.ceil(altura / tamanhoCelula));
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const cel = new Int32Array(n);
  const contagem = new Int32Array(colunas * linhas + 1);
  for (let i = 0; i < n; i++) {
    xs[i] = posicoes[2 * i]!;
    ys[i] = posicoes[2 * i + 1]!;
    const c = Math.min(colunas - 1, Math.max(0, Math.floor(xs[i]! / tamanhoCelula)));
    const l = Math.min(linhas - 1, Math.max(0, Math.floor(ys[i]! / tamanhoCelula)));
    cel[i] = l * colunas + c;
    contagem[cel[i]! + 1]!++;
  }
  for (let k = 0; k < colunas * linhas; k++) contagem[k + 1]! += contagem[k]!;
  const inicios = contagem.slice();
  const cursor = contagem.slice(0, colunas * linhas);
  const itens = new Int32Array(n);
  for (let i = 0; i < n; i++) itens[cursor[cel[i]!]!++] = i;
  return { tamanhoCelula, colunas, linhas, inicios, itens, xs, ys, n };
}

/**
 * Índice do ponto sob (x, y) dentro de `raio`. Em caso de sobreposição, vence o desenhado por último
 * (maior índice) entre os que contêm o ponto; se nenhum o contém, nada é devolvido.
 */
export function acharPonto(g: GradeEspacial, x: number, y: number, raio: number): number {
  const c0 = Math.max(0, Math.floor((x - raio) / g.tamanhoCelula));
  const c1 = Math.min(g.colunas - 1, Math.floor((x + raio) / g.tamanhoCelula));
  const l0 = Math.max(0, Math.floor((y - raio) / g.tamanhoCelula));
  const l1 = Math.min(g.linhas - 1, Math.floor((y + raio) / g.tamanhoCelula));
  const r2 = raio * raio;
  let melhor = -1;
  for (let l = l0; l <= l1; l++) {
    for (let c = c0; c <= c1; c++) {
      const k = l * g.colunas + c;
      for (let p = g.inicios[k]!; p < g.inicios[k + 1]!; p++) {
        const i = g.itens[p]!;
        const dx = g.xs[i]! - x;
        const dy = g.ys[i]! - y;
        if (dx * dx + dy * dy <= r2 && i > melhor) melhor = i;
      }
    }
  }
  return melhor;
}

/** Índices dos pontos cujo centro está no retângulo (limites inclusive), em ordem crescente. */
export function acharEmRetangulo(g: GradeEspacial, x0: number, y0: number, x1: number, y1: number): number[] {
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1);
  const yb = Math.max(y0, y1);
  const c0 = Math.max(0, Math.floor(xa / g.tamanhoCelula));
  const c1 = Math.min(g.colunas - 1, Math.floor(xb / g.tamanhoCelula));
  const l0 = Math.max(0, Math.floor(ya / g.tamanhoCelula));
  const l1 = Math.min(g.linhas - 1, Math.floor(yb / g.tamanhoCelula));
  const achados: number[] = [];
  for (let l = l0; l <= l1; l++) {
    for (let c = c0; c <= c1; c++) {
      const k = l * g.colunas + c;
      for (let p = g.inicios[k]!; p < g.inicios[k + 1]!; p++) {
        const i = g.itens[p]!;
        if (g.xs[i]! >= xa && g.xs[i]! <= xb && g.ys[i]! >= ya && g.ys[i]! <= yb) achados.push(i);
      }
    }
  }
  return achados.sort((a, b) => a - b);
}
