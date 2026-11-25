// Camada vetorial do gráfico (eixos, rótulos, linhas de medidas, contagens) como lista de primitivas.
// A mesma lista alimenta o SVG na tela e o canvas da exportação em PNG. Coordenadas relativas ao canto
// superior esquerdo da área dos pontos (rótulos dos eixos ficam fora dela, em coordenadas negativas ou > largura/altura).
import { definirIntervalos, formatarNumero, indiceDoIntervalo, marcasBonitas } from '../../grafico/algoritmos/intervalos';
import { media, mediana, modas, porcentagem } from '../../grafico/algoritmos/medidas';
import type { ConfigEixo, MetaEixo } from '../../grafico/algoritmos/posicoes';
import { agruparCategorias } from '../../grafico/algoritmos/separar';
import type { Faixa } from '../../grafico/algoritmos/tipos';
import type { EixoResolvido } from './dadosEixo';
import type { EstadoGrafico, Medida } from './estado';
import type { Layout, Margem } from './layout';
import { LARGURA_CARACTERE } from './layout';
import { corDoGradiente, type Legenda } from './cores';
import { textos } from './textos';

export type PapelPrimitiva =
  | 'eixo' | 'marca' | 'rotulo-marca' | 'rotulo-faixa' | 'nome-eixo' | 'separador'
  | 'medida' | 'rotulo-medida' | 'contagem' | 'sem-valor' | 'legenda';

export interface Linha {
  tipo: 'linha';
  x1: number; y1: number; x2: number; y2: number;
  cor: string; largura: number; tracejado?: number[];
  papel: PapelPrimitiva;
}
export interface Texto {
  tipo: 'texto';
  x: number; y: number; texto: string;
  ancora: 'start' | 'middle' | 'end';
  tamanho: number; cor: string; negrito?: boolean;
  /** Graus, em torno de (x, y). */
  rotacao?: number;
  /** Contorno branco para ler sobre os pontos. */
  halo?: boolean;
  /** Texto completo, quando `texto` foi abreviado. */
  titulo?: string;
  papel: PapelPrimitiva;
}
export interface Retangulo {
  tipo: 'retangulo';
  x: number; y: number; l: number; a: number;
  preenchimento: string; contorno?: string;
  papel: PapelPrimitiva;
}
export type Primitiva = Linha | Texto | Retangulo;

const COR_EIXO = '#6a6a85';
const COR_TEXTO = '#1b1747';
const COR_SEPARADOR = '#d9d9e6';
export const ESTILO_MEDIDA: Record<'media' | 'mediana' | 'moda', { cor: string; tracejado?: number[] }> = {
  media: { cor: '#b3261e' },
  mediana: { cor: '#00695c', tracejado: [9, 5] },
  moda: { cor: '#6a1b9a', tracejado: [2, 5] },
};
const MAX_LINHAS_MODA = 5;

export function abreviar(texto: string, max: number): string {
  const m = Math.max(2, Math.floor(max));
  return texto.length > m ? `${texto.slice(0, m - 1)}…` : texto;
}

export function nomeDoEixo(r: EixoResolvido): string {
  const a = r.atributo;
  if (!a) return '';
  return a.unidade ? `${a.nome} (${a.unidade})` : a.nome;
}

/** Função valor → posição em pixels ao longo do eixo numérico, ou null se o eixo não tem escala por valor. */
export function escalaDoEixo(meta: MetaEixo, cfg: ConfigEixo): ((v: number) => number) | null {
  if (cfg.tipo !== 'numerico' || cfg.modo === 'ordenar' || meta.marcas.length === 0) return null;
  let valores: number[];
  if (cfg.modo === 'intervalos') {
    valores = definirIntervalos(cfg.valores?.map((v) => (typeof v === 'number' ? v : null)) ?? [], { largura: cfg.larguraIntervalo }).limites;
  } else if (meta.dominio) {
    valores = marcasBonitas(meta.dominio[0], meta.dominio[1]);
  } else {
    return null;
  }
  if (valores.length !== meta.marcas.length) return null;
  if (valores.length === 1) {
    const p = meta.marcas[0]!.posicao;
    return () => p;
  }
  const v0 = valores[0]!;
  const v1 = valores[valores.length - 1]!;
  const p0 = meta.marcas[0]!.posicao;
  const p1 = meta.marcas[meta.marcas.length - 1]!.posicao;
  if (v1 === v0) return null;
  const k = (p1 - p0) / (v1 - v0);
  return (v) => p0 + (v - v0) * k;
}

function eixoDeGrupo(r: EixoResolvido, meta: MetaEixo): { faixas: Faixa[]; indice: number[] } | null {
  if (meta.faixas.length === 0) return null;
  if (r.cfg.tipo === 'categorico') {
    const ag = agruparCategorias(r.cfg.valores ?? [], r.cfg.ordemCategorias);
    return { faixas: meta.faixas, indice: ag.indice };
  }
  if (r.cfg.tipo === 'numerico' && r.cfg.modo === 'intervalos' && r.numeros) {
    const def = definirIntervalos(r.numeros, { largura: r.cfg.larguraIntervalo });
    return { faixas: meta.faixas, indice: r.numeros.map((v) => indiceDoIntervalo(v, def)) };
  }
  return null;
}

export function formatarPorcentagem(p: number): string {
  return `${formatarNumero(Math.round(p * 10) / 10, true)}%`;
}

export function formatarMedida(v: number): string {
  return formatarNumero(Math.round(v * 100) / 100, true);
}

function eixosEMarcas(layout: Layout, margem: Margem, out: Primitiva[]): void {
  const W = layout.largura;
  const H = layout.altura;
  const mx = layout.resultado.eixoX;
  const my = layout.resultado.eixoY;
  const rx = layout.x;
  const ry = layout.y;
  const tx = (texto: string, x: number, y: number, extra: Partial<Texto>): Texto => ({
    tipo: 'texto', texto, x, y, ancora: 'middle', tamanho: 13, cor: COR_TEXTO, papel: 'rotulo-marca', ...extra,
  });

  if (rx.cfg.tipo !== 'nenhum') {
    out.push({ tipo: 'linha', x1: 0, y1: H, x2: W, y2: H, cor: COR_EIXO, largura: 1.5, papel: 'eixo' });
    const ehFaixa = rx.cfg.tipo === 'categorico';
    mx.marcas.forEach((m, i) => {
      out.push({ tipo: 'linha', x1: m.posicao, y1: H, x2: m.posicao, y2: H + 5, cor: COR_EIXO, largura: 1.5, papel: 'marca' });
      const f = mx.faixas[i];
      const max = ehFaixa && f ? (f.fim - f.ini - 4) / LARGURA_CARACTERE : 40;
      const curto = abreviar(m.rotulo, max);
      out.push(tx(curto, m.posicao, H + 19, { ...(curto !== m.rotulo ? { titulo: m.rotulo } : {}) }));
    });
    if (rx.cfg.modo === 'intervalos') {
      mx.faixas.forEach((f) => {
        if ((f.fim - f.ini) >= f.rotulo.length * LARGURA_CARACTERE * 0.92 + 4) {
          out.push(tx(f.rotulo, (f.ini + f.fim) / 2, H + 35, { papel: 'rotulo-faixa', tamanho: 12 }));
        }
      });
    }
    separadores(mx, 'x', W, H, out);
    out.push(tx(nomeDoEixo(rx), W / 2, H + (rx.cfg.modo === 'intervalos' ? 58 : 40), { papel: 'nome-eixo', negrito: true, tamanho: 14 }));
  }

  if (ry.cfg.tipo !== 'nenhum') {
    out.push({ tipo: 'linha', x1: 0, y1: 0, x2: 0, y2: H, cor: COR_EIXO, largura: 1.5, papel: 'eixo' });
    const maxChars = (margem.esq - 34) / LARGURA_CARACTERE;
    const porFaixa = ry.cfg.tipo === 'categorico' || ry.cfg.modo === 'intervalos';
    my.marcas.forEach((m) => {
      out.push({ tipo: 'linha', x1: -5, y1: m.posicao, x2: 0, y2: m.posicao, cor: COR_EIXO, largura: 1.5, papel: 'marca' });
      if (ry.cfg.tipo === 'numerico' && ry.cfg.modo !== 'intervalos') {
        out.push(tx(m.rotulo, -9, m.posicao + 4.5, { ancora: 'end' }));
      } else if (ry.cfg.tipo === 'categorico') {
        const curto = abreviar(m.rotulo, maxChars);
        out.push(tx(curto, -9, m.posicao + 4.5, { ancora: 'end', ...(curto !== m.rotulo ? { titulo: m.rotulo } : {}) }));
      }
    });
    if (porFaixa && ry.cfg.tipo === 'numerico') {
      my.faixas.forEach((f) => out.push(tx(f.rotulo, -9, (f.ini + f.fim) / 2 + 4.5, { ancora: 'end', papel: 'rotulo-faixa', tamanho: 12 })));
    }
    separadores(my, 'y', W, H, out);
    out.push(tx(nomeDoEixo(ry), -(margem.esq - 14), H / 2, { papel: 'nome-eixo', negrito: true, tamanho: 14, rotacao: -90 }));
  }
}

function separadores(meta: MetaEixo, qual: 'x' | 'y', W: number, H: number, out: Primitiva[]): void {
  const linha = (p: number): Linha =>
    qual === 'x'
      ? { tipo: 'linha', x1: p, y1: 0, x2: p, y2: H, cor: COR_SEPARADOR, largura: 1, tracejado: [4, 4], papel: 'separador' }
      : { tipo: 'linha', x1: 0, y1: p, x2: W, y2: p, cor: COR_SEPARADOR, largura: 1, tracejado: [4, 4], papel: 'separador' };
  const limites = new Set<number>();
  const ordenadas = [...meta.faixas].sort((a, b) => a.ini - b.ini);
  ordenadas.slice(0, -1).forEach((f) => limites.add(Math.round(f.fim * 100) / 100));
  if (meta.semValor) limites.add(Math.round(meta.semValor.ini * 100) / 100);
  limites.forEach((p) => out.push(linha(p)));
  if (meta.semValor) {
    const s = meta.semValor;
    out.push(
      qual === 'x'
        ? { tipo: 'texto', texto: textos.semValor, x: (s.ini + s.fim) / 2, y: 14, ancora: 'middle', tamanho: 11, cor: '#555', papel: 'sem-valor' }
        : { tipo: 'texto', texto: textos.semValor, x: 6, y: (s.ini + s.fim) / 2 + 4, ancora: 'start', tamanho: 11, cor: '#555', papel: 'sem-valor' },
    );
  }
}

function linhasDeMedidas(layout: Layout, mostrar: readonly Medida[], out: Primitiva[]): void {
  const pedidas = (['media', 'mediana', 'moda'] as const).filter((m) => mostrar.includes(m));
  if (pedidas.length === 0) return;
  const { x, y } = layout;
  const xNum = x.cfg.tipo === 'numerico';
  const yNum = y.cfg.tipo === 'numerico';
  if (xNum === yNum) return; // sem eixo numérico, ou dois numéricos (dispersão): sem linhas
  const N = xNum ? x : y;
  const O = xNum ? y : x;
  const metaN = xNum ? layout.resultado.eixoX : layout.resultado.eixoY;
  const metaO = xNum ? layout.resultado.eixoY : layout.resultado.eixoX;
  const esc = escalaDoEixo(metaN, N.cfg);
  if (!esc || !N.numeros) return;
  const extensao = xNum ? layout.altura : layout.largura;
  const grupoO = eixoDeGrupo(O, metaO);
  const nGrupos = grupoO ? grupoO.faixas.length : 1;
  for (let g = 0; g < nGrupos; g++) {
    const banda: Faixa = grupoO ? grupoO.faixas[g]! : { ini: 0, fim: extensao };
    const valores: number[] = [];
    N.numeros.forEach((v, i) => {
      if (v !== null && (!grupoO || grupoO.indice[i] === g)) valores.push(v);
    });
    if (valores.length === 0) continue;
    let k = 0;
    for (const medida of pedidas) {
      const vs: number[] =
        medida === 'media' ? [media(valores)!] : medida === 'mediana' ? [mediana(valores)!] : modas(valores).slice(0, MAX_LINHAS_MODA);
      const estilo = ESTILO_MEDIDA[medida];
      for (const v of vs) {
        const p = esc(v);
        const rotulo = `${textos.rotuloLinhaMedida[medida]} ${formatarMedida(v)}`;
        if (xNum) {
          out.push({ tipo: 'linha', x1: p, y1: banda.ini, x2: p, y2: banda.fim, cor: estilo.cor, largura: 2.5, ...(estilo.tracejado ? { tracejado: estilo.tracejado } : {}), papel: 'medida' });
          out.push({ tipo: 'texto', texto: rotulo, x: p + 4, y: banda.ini + 28 + 13 * k, ancora: 'start', tamanho: 12, cor: estilo.cor, negrito: true, halo: true, papel: 'rotulo-medida' });
        } else {
          out.push({ tipo: 'linha', x1: banda.ini, y1: p, x2: banda.fim, y2: p, cor: estilo.cor, largura: 2.5, ...(estilo.tracejado ? { tracejado: estilo.tracejado } : {}), papel: 'medida' });
          out.push({ tipo: 'texto', texto: rotulo, x: banda.ini + 6, y: p - 4 - 13 * k, ancora: 'start', tamanho: 12, cor: estilo.cor, negrito: true, halo: true, papel: 'rotulo-medida' });
        }
        k++;
      }
    }
  }
}

function rotulosDeContagem(layout: Layout, mostrar: readonly Medida[], out: Primitiva[]): void {
  const querN = mostrar.includes('contagem');
  const querP = mostrar.includes('porcentagem');
  if (!querN && !querP) return;
  const gx = eixoDeGrupo(layout.x, layout.resultado.eixoX);
  const gy = eixoDeGrupo(layout.y, layout.resultado.eixoY);
  const nx = gx ? gx.faixas.length : 1;
  const ny = gy ? gy.faixas.length : 1;
  const cont = new Map<number, number>();
  let total = 0;
  for (let i = 0; i < layout.ids.length; i++) {
    const ix = gx ? gx.indice[i]! : 0;
    const iy = gy ? gy.indice[i]! : 0;
    if (ix < 0 || iy < 0) continue;
    total++;
    const chave = iy * nx + ix;
    cont.set(chave, (cont.get(chave) ?? 0) + 1);
  }
  const unidimensional = !(gx && gy);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const n = cont.get(iy * nx + ix) ?? 0;
      if (n === 0 && !unidimensional) continue;
      const fx: Faixa = gx ? gx.faixas[ix]! : { ini: 0, fim: layout.largura };
      const fy: Faixa = gy ? gy.faixas[iy]! : { ini: 0, fim: layout.altura };
      const partes: string[] = [];
      if (querN) partes.push(String(n));
      if (querP) partes.push(formatarPorcentagem(porcentagem(n, total)));
      const texto = querN && querP ? `${partes[0]} (${partes[1]})` : partes[0]!;
      out.push({ tipo: 'texto', texto, x: fx.fim - 5, y: fy.ini + 14, ancora: 'end', tamanho: 13, cor: COR_TEXTO, negrito: true, halo: true, papel: 'contagem' });
    }
  }
}

export function construirCena(layout: Layout, estado: Pick<EstadoGrafico, 'mostrar'>, margem: Margem): Primitiva[] {
  const out: Primitiva[] = [];
  eixosEMarcas(layout, margem, out);
  linhasDeMedidas(layout, estado.mostrar, out);
  rotulosDeContagem(layout, estado.mostrar, out);
  return out;
}

export const LARGURA_LEGENDA = 190;

/** Legenda de cores como primitivas (usada na exportação; na tela a legenda é HTML). */
export function primitivasDaLegenda(legenda: Legenda, x: number, y: number): Primitiva[] {
  const out: Primitiva[] = [];
  out.push({ tipo: 'texto', texto: abreviar(legenda.titulo, 24), x, y: y + 12, ancora: 'start', tamanho: 13, cor: COR_TEXTO, negrito: true, papel: 'legenda' });
  if (legenda.tipo === 'categorica') {
    legenda.itens.slice(0, 20).forEach((item, i) => {
      const yy = y + 24 + i * 20;
      out.push({ tipo: 'retangulo', x, y: yy, l: 14, a: 14, preenchimento: item.cor, contorno: '#555', papel: 'legenda' });
      out.push({ tipo: 'texto', texto: abreviar(item.rotulo, 20), x: x + 20, y: yy + 12, ancora: 'start', tamanho: 12, cor: COR_TEXTO, papel: 'legenda' });
    });
  } else {
    const passos = 24;
    for (let i = 0; i < passos; i++) {
      out.push({ tipo: 'retangulo', x: x + i * 6, y: y + 24, l: 6.5, a: 14, preenchimento: corDoGradiente(i / (passos - 1), legenda.paradas), papel: 'legenda' });
    }
    out.push({ tipo: 'texto', texto: legenda.rotuloMinimo, x, y: y + 52, ancora: 'start', tamanho: 12, cor: COR_TEXTO, papel: 'legenda' });
    out.push({ tipo: 'texto', texto: legenda.rotuloMaximo, x: x + passos * 6, y: y + 52, ancora: 'end', tamanho: 12, cor: COR_TEXTO, papel: 'legenda' });
  }
  return out;
}
