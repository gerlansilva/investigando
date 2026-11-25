import { ROTULO_SEM_VALOR, type Faixa } from './tipos';

export interface Deslocamento {
  dx: number;
  /** Positivo para baixo (coordenada de tela), medido a partir do centro do retângulo. */
  dy: number;
}

/**
 * Grade compacta para n pontos num retângulo w × h com ícones de diâmetro d, centrada no retângulo.
 * Preenche da linha de baixo para cima, da esquerda para a direita. Se não couber com passo d,
 * comprime o passo (os ícones se sobrepõem) para manter os centros dentro do retângulo.
 */
export function gradeCompacta(n: number, w: number, h: number, d: number): Deslocamento[] {
  if (n <= 0) return [];
  const dd = Math.max(d, 1e-9);
  const aw = Math.max(0, w - dd);
  const ah = Math.max(0, h - dd);
  const maxCols = Math.floor(aw / dd + 1e-9) + 1;
  const maxRows = Math.floor(ah / dd + 1e-9) + 1;
  const proporcao = w > 0 && h > 0 ? w / h : 1;
  let cols = Math.max(1, Math.ceil(Math.sqrt(n * proporcao)));
  if (cols > maxCols) cols = maxCols;
  let rows = Math.ceil(n / cols);
  if (rows > maxRows && cols < maxCols) {
    cols = Math.min(maxCols, Math.ceil(n / maxRows));
    rows = Math.ceil(n / cols);
  }
  const passoX = cols > 1 ? Math.min(dd, aw / (cols - 1)) : 0;
  const passoY = rows > 1 ? Math.min(dd, ah / (rows - 1)) : 0;
  const saida: Deslocamento[] = [];
  for (let k = 0; k < n; k++) {
    const r = Math.floor(k / cols);
    const c = k % cols;
    const naLinha = Math.min(cols, n - r * cols);
    saida.push({
      dx: (c - (naLinha - 1) / 2) * passoX,
      dy: ((rows - 1) * passoY) / 2 - r * passoY,
    });
  }
  return saida;
}

export interface AgrupamentoCategorico {
  categorias: string[];
  /** Índice da categoria de cada caso. */
  indice: number[];
}

/**
 * Categorias na ordem escolhida (as de `ordem` que existem), depois as demais por primeira aparição;
 * casos nulos formam a categoria "(sem valor)", sempre por último.
 */
export function agruparCategorias(
  valores: readonly (string | number | null | undefined)[],
  ordem?: readonly string[],
): AgrupamentoCategorico {
  const rot = valores.map((v) => (v === null || v === undefined ? ROTULO_SEM_VALOR : String(v)));
  const presentes = new Set(rot);
  const categorias: string[] = [];
  const vistos = new Set<string>();
  for (const o of ordem ?? []) {
    if (presentes.has(o) && !vistos.has(o) && o !== ROTULO_SEM_VALOR) {
      vistos.add(o);
      categorias.push(o);
    }
  }
  let nulo = false;
  for (const r of rot) {
    if (vistos.has(r)) continue;
    if (r === ROTULO_SEM_VALOR && valores.some((v) => v === null || v === undefined)) {
      nulo = true;
      continue;
    }
    vistos.add(r);
    categorias.push(r);
  }
  if (nulo) categorias.push(ROTULO_SEM_VALOR);
  const pos = new Map(categorias.map((c, i) => [c, i]));
  return { categorias, indice: rot.map((r) => pos.get(r)!) };
}

export interface OpcoesSepararCategorico {
  largura: number;
  altura: number;
  diametro: number;
  ordem?: readonly string[];
}

export interface ColunaCategorica extends Faixa {
  categoria: string;
  centro: number;
  quantidade: number;
}

export interface ResultadoSepararCategorico {
  /** x, y por caso, na ordem da entrada. */
  pontos: { x: number; y: number }[];
  colunas: ColunaCategorica[];
}

/** Separa por categoria: colunas de largura igual e grade compacta dentro de cada coluna. */
export function separarCategorico(
  valores: readonly (string | number | null | undefined)[],
  op: OpcoesSepararCategorico,
): ResultadoSepararCategorico {
  const ag = agruparCategorias(valores, op.ordem);
  const nc = ag.categorias.length;
  if (nc === 0) return { pontos: [], colunas: [] };
  const w = op.largura / nc;
  const membros: number[][] = ag.categorias.map(() => []);
  ag.indice.forEach((c, i) => membros[c]!.push(i));
  const pontos = valores.map(() => ({ x: 0, y: 0 }));
  const colunas: ColunaCategorica[] = ag.categorias.map((categoria, c) => ({
    categoria,
    ini: c * w,
    fim: (c + 1) * w,
    centro: (c + 0.5) * w,
    quantidade: membros[c]!.length,
  }));
  membros.forEach((idx, c) => {
    const g = gradeCompacta(idx.length, w, op.altura, op.diametro);
    idx.forEach((caso, k) => {
      pontos[caso] = { x: colunas[c]!.centro + g[k]!.dx, y: op.altura / 2 + g[k]!.dy };
    });
  });
  return { pontos, colunas };
}

export interface Escala {
  dominio: [number, number];
  imagem: [number, number];
  /** Converte valor em posição; valores fora do domínio são presos às extremidades. */
  aplicar(v: number): number;
}

/** Escala linear. Domínio degenerado (min = max) leva ao centro da imagem. */
export function escalaLinear(dominio: readonly [number, number], imagem: readonly [number, number]): Escala {
  const [d0, d1] = dominio;
  const [i0, i1] = imagem;
  return {
    dominio: [d0, d1],
    imagem: [i0, i1],
    aplicar(v: number) {
      if (!(d1 > d0)) return (i0 + i1) / 2;
      const t = Math.min(1, Math.max(0, (v - d0) / (d1 - d0)));
      return i0 + t * (i1 - i0);
    },
  };
}

export interface OpcoesSepararNumerico {
  inicio: number;
  fim: number;
  /** Domínio mínimo/máximo explícito; se ausente, usa [mínimo, máximo] dos valores. */
  dominio?: readonly [number, number];
}

export interface ResultadoSepararNumerico {
  posicoes: (number | null)[];
  dominio: [number, number] | null;
}

export function separarNumerico(
  valores: readonly (number | null | undefined)[],
  op: OpcoesSepararNumerico,
): ResultadoSepararNumerico {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of valores) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const dom: [number, number] | null = op.dominio
    ? [op.dominio[0], op.dominio[1]]
    : lo <= hi
      ? [lo, hi]
      : null;
  if (!dom) return { posicoes: valores.map(() => null), dominio: null };
  const esc = escalaLinear(dom, [op.inicio, op.fim]);
  return {
    posicoes: valores.map((v) => (typeof v === 'number' && Number.isFinite(v) ? esc.aplicar(v) : null)),
    dominio: dom,
  };
}
