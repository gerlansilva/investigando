import { definirIntervalos, formatarNumero, marcasBonitas, indiceDoIntervalo } from './intervalos';
import { dispersarLateral, empilhar } from './empilhar';
import { ordenar } from './ordenar';
import { agruparCategorias, escalaLinear, gradeCompacta } from './separar';
import { numeroOuNulo, type Faixa, type Ponto, type Valor } from './tipos';

export type TipoEixo = 'nenhum' | 'categorico' | 'numerico';
export type ModoEixo = 'separar' | 'ordenar' | 'empilhar' | 'intervalos';

export interface ConfigEixo {
  tipo: TipoEixo;
  /** Padrão: 'separar'. */
  modo?: ModoEixo;
  /** Valor do atributo por caso, na mesma ordem de `ids`. */
  valores?: readonly Valor[];
  ordemCategorias?: readonly string[];
  /** Domínio numérico explícito [mínimo, máximo]. */
  dominio?: readonly [number, number];
  /** Largura dos intervalos (modo 'intervalos'); padrão: regra de Sturges. */
  larguraIntervalo?: number;
  /** Vírgula decimal nos rótulos (padrão: verdadeiro, pt-BR). */
  virgulaDecimal?: boolean;
  /** Modo 'ordenar' numérico: posições proporcionais ao valor (padrão: espaçamento igual). */
  ordenarProporcional?: boolean;
  decrescente?: boolean;
}

export const EIXO_NENHUM: ConfigEixo = { tipo: 'nenhum' };

export interface ConfigPosicoes {
  /** Casos visíveis, na ordem em que serão desenhados. */
  ids: readonly string[];
  x: ConfigEixo;
  y: ConfigEixo;
  largura: number;
  altura: number;
  diametro: number;
  /** Ordem dentro das pilhas: 'valor' (padrão, usa valoresOrdem) ou 'caso'. */
  ordemEmpilhamento?: 'caso' | 'valor';
  valoresOrdem?: readonly Valor[];
}

export interface Marca {
  posicao: number;
  rotulo: string;
}

export interface FaixaRotulada extends Faixa {
  rotulo: string;
}

export interface MetaEixo {
  tipo: TipoEixo;
  modo: ModoEixo;
  marcas: Marca[];
  /** Colunas/linhas (categorias ou intervalos), quando existem. */
  faixas: FaixaRotulada[];
  dominio: [number, number] | null;
  /** Região reservada aos casos sem valor (no fim do eixo: direita em X, topo em Y). */
  semValor: Faixa | null;
}

export interface ResultadoPosicoes {
  pontos: Ponto[];
  eixoX: MetaEixo;
  eixoY: MetaEixo;
  /** < 1 quando foi preciso reduzir o ícone (último recurso da compactação). */
  fatorIcone: number;
  diametroEfetivo: number;
}

interface Resolvido {
  ativo: boolean;
  categ: boolean;
  empilha: boolean;
  p: number[];
  grupo: number[];
  faixas: Faixa[];
  meta: MetaEixo;
}

const compr = (f: Faixa) => f.fim - f.ini;

function metaVazia(cfg: ConfigEixo): MetaEixo {
  return { tipo: cfg.tipo, modo: cfg.modo ?? 'separar', marcas: [], faixas: [], dominio: null, semValor: null };
}

function resolverEixo(cfg: ConfigEixo, n: number, C: number, d: number, vertical: boolean): Resolvido {
  const modo = cfg.modo ?? 'separar';
  const meta = metaVazia(cfg);
  const virg = cfg.virgulaDecimal ?? true;
  const m = Math.min(d / 2, C / 2);
  const val = (i: number): Valor => cfg.valores?.[i] ?? null;
  const todos = Array.from({ length: n }, (_, i) => val(i));
  const base: Resolvido = {
    ativo: cfg.tipo !== 'nenhum',
    categ: false,
    empilha: false,
    p: new Array<number>(n).fill(C / 2),
    grupo: new Array<number>(n).fill(-1),
    faixas: [],
    meta,
  };
  if (cfg.tipo === 'nenhum') return base;

  if (cfg.tipo === 'categorico') {
    const ag = agruparCategorias(todos, cfg.ordemCategorias);
    if (modo === 'ordenar') {
      const r = ordenar(ag.indice, { inicio: m, fim: C - m, decrescente: cfg.decrescente });
      base.p = r.posicoes.map((x) => x ?? C / 2);
      return base;
    }
    const nc = ag.categorias.length;
    const w = nc > 0 ? C / nc : C;
    base.faixas = ag.categorias.map((_, i) => ({ ini: i * w, fim: (i + 1) * w }));
    base.p = ag.indice.map((g) => (g + 0.5) * w);
    base.grupo = ag.indice;
    base.categ = true;
    base.empilha = modo === 'empilhar' || modo === 'intervalos';
    meta.faixas = base.faixas.map((f, i) => ({ ...f, rotulo: ag.categorias[i]! }));
    meta.marcas = meta.faixas.map((f, i) => ({ posicao: (f.ini + f.fim) / 2, rotulo: ag.categorias[i]! }));
    return base;
  }

  // numérico
  const nums = todos.map(numeroOuNulo);
  const validos = nums.filter((x): x is number => x !== null);
  const temNulos = validos.length < n;
  const banda = temNulos ? Math.max(Math.min(0.2 * C, 3 * d), Math.min(d, C)) : 0;
  const fimNum = temNulos ? Math.max(m, C - banda - m) : Math.max(m, C - m);
  const centroNulos = Math.min(Math.max(C - banda / 2, m), Math.max(m, C - m));
  if (temNulos) meta.semValor = { ini: C - banda, fim: C };

  let lo = Infinity;
  let hi = -Infinity;
  for (const x of validos) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  let dom: [number, number] | null = cfg.dominio ? [cfg.dominio[0], cfg.dominio[1]] : validos.length ? [lo, hi] : null;

  const faixasLista: Faixa[] = [];
  const rotulosFaixas: string[] = [];
  const marcas: Marca[] = [];
  const grupo = new Array<number>(n).fill(-1);

  if (modo === 'intervalos') {
    const def = definirIntervalos(nums, { largura: cfg.larguraIntervalo, virgulaDecimal: virg });
    if (def.quantidade > 0) {
      dom = [def.limites[0]!, def.limites[def.quantidade]!];
      const esc = escalaLinear(dom, [m, fimNum]);
      for (let g = 0; g < def.quantidade; g++) {
        faixasLista.push({ ini: esc.aplicar(def.limites[g]!), fim: esc.aplicar(def.limites[g + 1]!) });
        rotulosFaixas.push(def.rotulos[g]!);
      }
      def.limites.forEach((l) => marcas.push({ posicao: esc.aplicar(l), rotulo: formatarNumero(l, virg) }));
    }
    nums.forEach((x, i) => {
      grupo[i] = x === null ? -1 : indiceDoIntervalo(x, def);
    });
  } else if (modo === 'empilhar') {
    const esc = dom ? escalaLinear(dom, [m, fimNum]) : null;
    const maxB = Math.max(0, Math.floor((fimNum - m) / d + 1e-9));
    for (let b = 0; b <= maxB; b++) {
      faixasLista.push({ ini: m + b * d - d / 2, fim: m + b * d + d / 2 });
      rotulosFaixas.push('');
    }
    nums.forEach((x, i) => {
      if (x === null || !esc) return;
      grupo[i] = Math.min(maxB, Math.max(0, Math.round((esc.aplicar(x) - m) / d)));
    });
    if (dom) marcasBonitas(dom[0], dom[1]).forEach((v) => marcas.push({ posicao: esc!.aplicar(v), rotulo: formatarNumero(v, virg) }));
  } else if (modo === 'ordenar') {
    const prop = cfg.ordenarProporcional ?? false;
    const r = ordenar(nums, {
      inicio: m,
      fim: fimNum,
      modo: prop ? 'proporcional' : 'igual',
      decrescente: cfg.decrescente,
      dominio: cfg.dominio,
    });
    base.p = r.posicoes.map((x) => x ?? centroNulos);
    if (prop && dom) {
      const esc = escalaLinear(dom, cfg.decrescente ? [fimNum, m] : [m, fimNum]);
      marcasBonitas(dom[0], dom[1]).forEach((v) => marcas.push({ posicao: esc.aplicar(v), rotulo: formatarNumero(v, virg) }));
    }
  } else {
    const esc = dom ? escalaLinear(dom, [m, fimNum]) : null;
    base.p = nums.map((x) => (x === null || !esc ? centroNulos : esc.aplicar(x)));
    if (dom) marcasBonitas(dom[0], dom[1]).forEach((v) => marcas.push({ posicao: esc!.aplicar(v), rotulo: formatarNumero(v, virg) }));
  }

  if (modo === 'empilhar' || modo === 'intervalos') {
    base.empilha = true;
    base.categ = false;
    // posição ao longo do eixo = centro da faixa; casos nulos vão para a faixa de "sem valor"
    let gNulo = -1;
    if (nums.some((x) => x === null)) {
      gNulo = faixasLista.length;
      faixasLista.push({ ini: C - banda, fim: C });
      rotulosFaixas.push('');
    }
    base.p = nums.map((x, i) => {
      if (x === null) {
        grupo[i] = gNulo;
        return centroNulos;
      }
      const f = faixasLista[grupo[i]!];
      return f ? (f.ini + f.fim) / 2 : centroNulos;
    });
    base.faixas = faixasLista;
    base.grupo = grupo;
    meta.faixas = modo === 'intervalos' ? faixasLista.map((f, i) => ({ ...f, rotulo: rotulosFaixas[i] ?? '' })).filter((f) => f.rotulo !== '') : [];
  }
  meta.marcas = marcas;
  meta.dominio = dom;

  if (vertical) {
    // numérico em Y cresce para cima
    const inv = (v: number) => C - v;
    base.p = base.p.map(inv);
    base.faixas = base.faixas.map((f) => ({ ini: inv(f.fim), fim: inv(f.ini) }));
    meta.marcas = meta.marcas.map((k) => ({ ...k, posicao: inv(k.posicao) }));
    meta.faixas = meta.faixas.map((f) => ({ ...f, ini: inv(f.fim), fim: inv(f.ini) }));
    if (meta.semValor) meta.semValor = { ini: inv(meta.semValor.fim), fim: inv(meta.semValor.ini) };
  }
  return base;
}

/**
 * Calcula a posição-alvo de cada caso (pixels, origem no canto superior esquerdo) e os metadados dos eixos.
 *
 * Regras (decisões nossas, ver relatório):
 * - sem eixos: grade compacta na área toda;
 * - um eixo ativo: categórico "separar" = grade compacta na coluna; "empilhar"/"intervalos" = pilha a partir da
 *   base (embaixo se o eixo é X; à esquerda se é Y); numérico "separar"/"ordenar" = linha no meio;
 * - dois eixos categóricos: grade compacta em cada célula;
 * - numérico "empilhar"/"intervalos" × categórico: a pilha ocorre dentro da faixa da categoria;
 * - numérico "separar"/"ordenar" × categórico: espalhamento lateral dentro da faixa;
 * - numérico × numérico: posição direta (pontos podem se sobrepor).
 */
export function calcularPosicoes(cfg: ConfigPosicoes): ResultadoPosicoes {
  const n = cfg.ids.length;
  const W = Math.max(0, cfg.largura);
  const H = Math.max(0, cfg.altura);
  const d = Math.max(cfg.diametro, 1e-9);
  const X = resolverEixo(cfg.x, n, W, d, false);
  const Y = resolverEixo(cfg.y, n, H, d, cfg.y.tipo === 'numerico');
  const xs = new Array<number>(n).fill(W / 2);
  const ys = new Array<number>(n).fill(H / 2);
  let fator = 1;
  let diamEf = d;
  const ordem = cfg.ordemEmpilhamento;
  const usarEmpilhar = (chaves: (string | number | null)[], L: number, larg: (c: string | number | null) => number) => {
    const r = empilhar(chaves, { comprimento: L, diametro: d, larguraColuna: larg, margem: d / 2, ordem, valoresOrdem: cfg.valoresOrdem });
    fator = Math.min(fator, r.fatorIcone);
    diamEf = Math.min(diamEf, r.diametroEfetivo);
    return r.posicoes;
  };
  const porGrupo = (chaves: string[]): Map<string, number[]> => {
    const mp = new Map<string, number[]>();
    chaves.forEach((c, i) => {
      const g = mp.get(c);
      if (g) g.push(i);
      else mp.set(c, [i]);
    });
    return mp;
  };
  const gradeEmCelulas = (celula: (i: number) => { x: Faixa; y: Faixa }, chave: (i: number) => string) => {
    const mp = porGrupo(Array.from({ length: n }, (_, i) => chave(i)));
    for (const idx of mp.values()) {
      const c = celula(idx[0]!);
      const g = gradeCompacta(idx.length, compr(c.x), compr(c.y), d);
      idx.forEach((caso, k) => {
        xs[caso] = (c.x.ini + c.x.fim) / 2 + g[k]!.dx;
        ys[caso] = (c.y.ini + c.y.fim) / 2 + g[k]!.dy;
      });
    }
  };

  if (n > 0) {
    if (!X.ativo && !Y.ativo) {
      gradeEmCelulas(() => ({ x: { ini: 0, fim: W }, y: { ini: 0, fim: H } }), () => 'tudo');
    } else if (X.ativo !== Y.ativo) {
      const A = X.ativo ? X : Y;
      const horizontal = X.ativo;
      const Cp = horizontal ? H : W;
      if (A.empilha) {
        const pos = usarEmpilhar(A.grupo, Cp, (g) => (typeof g === 'number' && A.faixas[g] ? compr(A.faixas[g]!) : 0));
        for (let i = 0; i < n; i++) {
          if (horizontal) {
            xs[i] = A.p[i]! + pos[i]!.desvio;
            ys[i] = H - pos[i]!.altura;
          } else {
            xs[i] = pos[i]!.altura;
            ys[i] = A.p[i]! + pos[i]!.desvio;
          }
        }
      } else if (A.categ) {
        gradeEmCelulas(
          (i) => {
            const f = A.faixas[A.grupo[i]!]!;
            return horizontal ? { x: f, y: { ini: 0, fim: H } } : { x: { ini: 0, fim: W }, y: f };
          },
          (i) => String(A.grupo[i]),
        );
      } else {
        for (let i = 0; i < n; i++) {
          if (horizontal) xs[i] = A.p[i]!;
          else ys[i] = A.p[i]!;
        }
      }
    } else if (X.categ && Y.categ) {
      gradeEmCelulas(
        (i) => ({ x: X.faixas[X.grupo[i]!]!, y: Y.faixas[Y.grupo[i]!]! }),
        (i) => `${X.grupo[i]}|${Y.grupo[i]}`,
      );
    } else if (!X.categ && !Y.categ) {
      for (let i = 0; i < n; i++) {
        xs[i] = X.p[i]!;
        ys[i] = Y.p[i]!;
      }
    } else {
      const K = X.categ ? X : Y;
      const N = X.categ ? Y : X;
      const nHoriz = !X.categ; // eixo numérico é X
      if (N.empilha) {
        const bandaK = K.faixas[0] ? compr(K.faixas[0]) : 0;
        const chaves = Array.from({ length: n }, (_, i) => `${N.grupo[i]}|${K.grupo[i]}`);
        const pos = usarEmpilhar(chaves, bandaK, (c) => {
          const g = Number(String(c).split('|')[0]);
          return N.faixas[g] ? compr(N.faixas[g]!) : 0;
        });
        for (let i = 0; i < n; i++) {
          const fk = K.faixas[K.grupo[i]!]!;
          if (nHoriz) {
            xs[i] = N.p[i]! + pos[i]!.desvio;
            ys[i] = fk.fim - pos[i]!.altura;
          } else {
            xs[i] = fk.ini + pos[i]!.altura;
            ys[i] = N.p[i]! + pos[i]!.desvio;
          }
        }
      } else {
        const chaves = Array.from({ length: n }, (_, i) => `${K.grupo[i]}|${Math.round(N.p[i]! / d)}`);
        const larg = K.faixas[0] ? compr(K.faixas[0]) : 0;
        const desv = dispersarLateral(chaves, larg, d);
        for (let i = 0; i < n; i++) {
          if (nHoriz) {
            xs[i] = N.p[i]!;
            ys[i] = K.p[i]! + desv[i]!;
          } else {
            ys[i] = N.p[i]!;
            xs[i] = K.p[i]! + desv[i]!;
          }
        }
      }
    }
  }

  const rx = Math.min(d / 2, W / 2);
  const ry = Math.min(d / 2, H / 2);
  const pontos: Ponto[] = cfg.ids.map((id, i) => ({
    id,
    x: Math.min(W - rx, Math.max(rx, xs[i]!)),
    y: Math.min(H - ry, Math.max(ry, ys[i]!)),
  }));
  return { pontos, eixoX: X.meta, eixoY: Y.meta, fatorIcone: fator, diametroEfetivo: diamEf };
}

/** Gerador pseudoaleatório semeável (mulberry32): devolve números em [0, 1). */
export function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "Nuvem" inicial reproduzível: a mesma semente gera sempre as mesmas posições, dentro da área. */
export function posicoesIniciais(
  ids: readonly string[],
  largura: number,
  altura: number,
  semente: number,
  diametro = 0,
): Ponto[] {
  const rnd = mulberry32(semente);
  const rx = Math.min(diametro / 2, largura / 2);
  const ry = Math.min(diametro / 2, altura / 2);
  return ids.map((id) => ({
    id,
    x: rx + rnd() * Math.max(0, largura - 2 * rx),
    y: ry + rnd() * Math.max(0, altura - 2 * ry),
  }));
}
