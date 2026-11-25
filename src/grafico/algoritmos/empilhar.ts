import { compararValores } from './ordenar';
import type { Valor } from './tipos';

export type ChavePilha = string | number | null;

export interface OpcoesEmpilhar {
  /** Comprimento disponível ao longo da pilha (altura, para pilhas verticais). */
  comprimento: number;
  diametro: number;
  /** Largura da coluna: se a pilha não couber na altura, usa subcolunas enquanto houver largura. Número ou função da chave. */
  larguraColuna?: number | ((chave: ChavePilha) => number);
  /** Menor passo permitido, como fração do diâmetro efetivo (padrão 0,5 = sobreposição máxima de 50%). */
  fracaoMinimaPasso?: number;
  /**
   * Distância mínima entre a base (ou o topo) e o centro do primeiro (último) ícone. Padrão: metade do diâmetro
   * efetivo. Quem recorta as posições com uma margem nominal (meio diâmetro cheio) deve passá-la aqui; do contrário
   * o recorte comprime o passo depois da compactação e quebra a sobreposição máxima permitida.
   */
  margem?: number;
  /** 'caso': ordem dos casos; 'valor' (padrão): pelo valor de `valoresOrdem`, desempate pela ordem dos casos. */
  ordem?: 'caso' | 'valor';
  valoresOrdem?: readonly Valor[];
}

export interface PosicaoPilha {
  /** Deslocamento lateral em relação ao centro da coluna. */
  desvio: number;
  /** Distância do centro do ícone até a base, ao longo da pilha. */
  altura: number;
}

export interface InfoColuna {
  chave: ChavePilha;
  quantidade: number;
  linhas: number;
  subcolunas: number;
  passo: number;
}

export interface ResultadoEmpilhar {
  /** Uma posição por caso, na ordem da entrada. */
  posicoes: PosicaoPilha[];
  /** 1 se o ícone não precisou encolher; < 1 é o fator de redução do diâmetro (último recurso). */
  fatorIcone: number;
  diametroEfetivo: number;
  /** Menor distância permitida entre centros de linhas consecutivas da mesma pilha. */
  passoMinimo: number;
  colunas: InfoColuna[];
}

function chaveTexto(c: ChavePilha): string {
  return c === null ? '\u0000nulo' : typeof c === 'number' ? `n:${c}` : `s:${c}`;
}

/**
 * Empilha a partir da base. Para cada coluna (chave) com n casos e `linhas` linhas: se linhas × d cabe
 * no comprimento, passo = d; senão o passo é comprimido para (L − d)/(linhas − 1), até o mínimo
 * fracaoMinimaPasso × d; se nem assim couber, reduz o diâmetro do ícone pelo fator devolvido.
 */
export function empilhar(chaves: readonly ChavePilha[], op: OpcoesEmpilhar): ResultadoEmpilhar {
  const d = Math.max(op.diametro, 1e-9);
  const L = Math.max(0, op.comprimento);
  const fmin = op.fracaoMinimaPasso ?? 0.5;
  const grupos = new Map<string, { chave: ChavePilha; idx: number[] }>();
  chaves.forEach((c, i) => {
    const k = chaveTexto(c);
    let g = grupos.get(k);
    if (!g) grupos.set(k, (g = { chave: c, idx: [] }));
    g.idx.push(i);
  });
  const usarValor = (op.ordem ?? 'valor') === 'valor' && op.valoresOrdem !== undefined;
  const largDe = (c: ChavePilha): number =>
    op.larguraColuna === undefined ? 0 : typeof op.larguraColuna === 'function' ? op.larguraColuna(c) : op.larguraColuna;
  const info: { chave: ChavePilha; idx: number[]; sub: number; linhas: number }[] = [];
  let maxLinhas = 0;
  for (const g of grupos.values()) {
    if (usarValor) {
      const vo = op.valoresOrdem!;
      g.idx.sort((a, b) => {
        const va = vo[a] ?? null;
        const vb = vo[b] ?? null;
        if (va === null || vb === null) return (va === null ? 1 : 0) - (vb === null ? 1 : 0) || a - b;
        return compararValores(va, vb) || a - b;
      });
    }
    // Subcolunas só quando necessárias: usa o mínimo que evita compressão, limitado pela largura da coluna.
    const subMax = Math.max(1, Math.floor(largDe(g.chave) / d + 1e-9));
    const linhasCabem = Math.max(1, Math.floor(L / d + 1e-9));
    const sub = Math.min(subMax, Math.max(1, Math.ceil(g.idx.length / linhasCabem)));
    const linhas = Math.ceil(g.idx.length / sub);
    if (linhas > maxLinhas) maxLinhas = linhas;
    info.push({ chave: g.chave, idx: g.idx, sub, linhas });
  }
  let fator = 1;
  const M0 = Math.max(0, op.margem ?? 0);
  if (maxLinhas * d > L + 1e-9) {
    let f = L / (d * ((maxLinhas - 1) * fmin + 1));
    // Com margem nominal maior que metade do diâmetro efetivo, os centros ocupam só L − 2·margem.
    if (maxLinhas > 1 && M0 > (d * f) / 2 && L > 2 * M0) f = (L - 2 * M0) / (d * (maxLinhas - 1) * fmin);
    fator = Math.min(1, Math.max(0, f));
  }
  const de = d * fator;
  // Se a coluna é curta demais para a margem (L ≤ 2·margem), cai para metade do diâmetro efetivo.
  const margem = L > 2 * M0 ? Math.max(de / 2, M0) : de / 2;
  const posicoes: PosicaoPilha[] = chaves.map(() => ({ desvio: 0, altura: 0 }));
  const colunas: InfoColuna[] = [];
  for (const g of info) {
    const passo = g.linhas > 1 ? Math.min(de, (L - 2 * margem) / (g.linhas - 1)) : 0;
    g.idx.forEach((caso, k) => {
      const linha = Math.floor(k / g.sub);
      const naLinha = Math.min(g.sub, g.idx.length - linha * g.sub);
      posicoes[caso] = {
        altura: margem + linha * passo,
        desvio: ((k % g.sub) - (naLinha - 1) / 2) * de,
      };
    });
    colunas.push({ chave: g.chave, quantidade: g.idx.length, linhas: g.linhas, subcolunas: g.sub, passo });
  }
  return { posicoes, fatorIcone: fator, diametroEfetivo: de, passoMinimo: fmin * de, colunas };
}

/**
 * Espalha lateralmente casos que compartilham a mesma chave (para evitar sobreposição quando a outra
 * coordenada já está fixada). Devolve o deslocamento de cada caso, centrado em zero.
 */
export function dispersarLateral(
  chaves: readonly (string | number | null)[],
  larguraDisponivel: number,
  diametro: number,
): number[] {
  const grupos = new Map<string, number[]>();
  chaves.forEach((c, i) => {
    const k = chaveTexto(c);
    const g = grupos.get(k);
    if (g) g.push(i);
    else grupos.set(k, [i]);
  });
  const saida = chaves.map(() => 0);
  for (const idx of grupos.values()) {
    const m = idx.length;
    if (m < 2) continue;
    const passo = Math.min(diametro, Math.max(0, larguraDisponivel - diametro) / (m - 1));
    idx.forEach((caso, j) => {
      saida[caso] = (j - (m - 1) / 2) * passo;
    });
  }
  return saida;
}
