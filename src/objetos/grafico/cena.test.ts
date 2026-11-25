import { describe, expect, it } from 'vitest';
import { abreviar, construirCena, escalaDoEixo, formatarPorcentagem, primitivasDaLegenda, type Linha, type Texto } from './cena';
import { calcularCores, corDoGradiente, PALETA_CATEGORICA, corDaCategoria, COR_SEM_VALOR } from './cores';
import { aplicarFiltro } from './filtro';
import { areaInterna, calcularMargem, calcularNuvem, prepararLayout } from './layout';
import { A_IDADE, A_MEIO, A_TEMPO, colecaoPequena, estadoCom } from './testeUtil';

function montar(parcial: Parameters<typeof estadoCom>[0], largura = 600, altura = 300) {
  const estado = estadoCom(parcial);
  const colecao = colecaoPequena();
  const margem = calcularMargem(estado, colecao);
  const layout = prepararLayout({ estado, colecao, largura, altura });
  return { estado, colecao, margem, layout, cena: construirCena(layout, estado, margem) };
}
const textos = (c: ReturnType<typeof montar>['cena'], papel?: string) =>
  c.filter((p): p is Texto => p.tipo === 'texto' && (!papel || p.papel === papel)).map((p) => p.texto);

describe('cena: eixos', () => {
  it('categórico X: um rótulo por categoria, centrado na faixa, abaixo do eixo', () => {
    const { cena, layout } = montar({ x: { atributoId: A_MEIO, modo: 'separar' } });
    const rot = cena.filter((p): p is Texto => p.tipo === 'texto' && p.papel === 'rotulo-marca');
    expect(rot.map((r) => r.texto)).toEqual(['A', 'B', 'C']);
    const w = layout.largura / 3;
    expect(rot.map((r) => r.x)).toEqual([w / 2, w * 1.5, w * 2.5]);
    expect(rot.every((r) => r.y > layout.altura)).toBe(true);
    // separadores entre as 3 faixas
    expect(cena.filter((p) => p.tipo === 'linha' && p.papel === 'separador')).toHaveLength(2);
  });

  it('intervalos: ticks nos limites e rótulos [a; b[ por faixa', () => {
    const { cena } = montar({ x: { atributoId: A_TEMPO, modo: 'intervalos', intervalos: { largura: 5 } } });
    expect(textos(cena, 'rotulo-marca')).toEqual(['0', '5', '10']);
    expect(textos(cena, 'rotulo-faixa')).toEqual(['[0; 5[', '[5; 10]']);
  });

  it('nome do eixo inclui a unidade', () => {
    const { cena } = montar({ x: { atributoId: A_TEMPO, modo: 'separar' } });
    expect(textos(cena, 'nome-eixo')).toEqual(['Tempo (min)']);
  });

  it('nomes longos de categoria são abreviados com título completo', () => {
    expect(abreviar('Transporte escolar municipal', 10)).toBe('Transport…');
    expect(abreviar('Oi', 10)).toBe('Oi');
  });

  it('sem eixos não há primitivas de eixo', () => {
    expect(montar({}).cena).toEqual([]);
  });

  it('nulos: faixa "(sem valor)" rotulada', () => {
    const estado = estadoCom({ x: { atributoId: A_TEMPO, modo: 'separar' } });
    const colecao = colecaoPequena();
    colecao.casos[0]!.valores[A_TEMPO] = null;
    const layout = prepararLayout({ estado, colecao, largura: 600, altura: 300 });
    const cena = construirCena(layout, estado, calcularMargem(estado, colecao));
    expect(textos(cena, 'sem-valor')).toEqual(['(sem valor)']);
  });
});

describe('cena: medidas e contagens', () => {
  it('escala do eixo numérico reproduz as posições dos pontos', () => {
    const { layout } = montar({ x: { atributoId: A_TEMPO, modo: 'separar' } });
    const esc = escalaDoEixo(layout.resultado.eixoX, layout.x.cfg)!;
    expect(esc).not.toBeNull();
    layout.x.numeros!.forEach((v, i) => expect(esc(v!)).toBeCloseTo(layout.alvo[2 * i]!, 6));
  });

  it('escala no eixo Y (invertido) e em intervalos', () => {
    const { layout } = montar({ y: { atributoId: A_TEMPO, modo: 'separar' } });
    const esc = escalaDoEixo(layout.resultado.eixoY, layout.y.cfg)!;
    layout.y.numeros!.forEach((v, i) => expect(esc(v!)).toBeCloseTo(layout.alvo[2 * i + 1]!, 6));
    const m2 = montar({ x: { atributoId: A_TEMPO, modo: 'intervalos', intervalos: { largura: 5 } } });
    const e2 = escalaDoEixo(m2.layout.resultado.eixoX, m2.layout.x.cfg)!;
    expect(e2(5)).toBeCloseTo(m2.layout.resultado.eixoX.marcas[1]!.posicao, 6);
  });

  it('sem escala em modo ordenar', () => {
    const { layout } = montar({ x: { atributoId: A_TEMPO, modo: 'ordenar' } });
    expect(escalaDoEixo(layout.resultado.eixoX, layout.x.cfg)).toBeNull();
  });

  it('média, mediana e moda: uma linha por grupo na posição certa', () => {
    const { cena, layout } = montar({
      x: { atributoId: A_TEMPO, modo: 'separar' },
      mostrar: ['media', 'mediana', 'moda'],
    });
    const linhas = cena.filter((p): p is Linha => p.tipo === 'linha' && p.papel === 'medida');
    // valores 0; 2,5; 5; 7,5; 10; 10: média 5,833..; mediana 6,25; moda 10
    expect(linhas).toHaveLength(3);
    const esc = escalaDoEixo(layout.resultado.eixoX, layout.x.cfg)!;
    expect(linhas[0]!.x1).toBeCloseTo(esc(35 / 6), 6);
    expect(linhas[1]!.x1).toBeCloseTo(esc(6.25), 6);
    expect(linhas[2]!.x1).toBeCloseTo(esc(10), 6);
    expect(textos(cena, 'rotulo-medida')).toEqual(['média 5,83', 'mediana 6,25', 'moda 10']);
    expect(linhas[1]!.tracejado).toBeDefined();
    expect(linhas[0]!.tracejado).toBeUndefined();
    // linhas ocupam a altura toda quando não há agrupamento
    expect(linhas[0]!.y1).toBe(0);
    expect(linhas[0]!.y2).toBe(layout.altura);
  });

  it('medidas por categoria quando o outro eixo é categórico (Y numérico: linhas horizontais)', () => {
    const { cena, layout } = montar({
      x: { atributoId: A_MEIO, modo: 'separar' },
      y: { atributoId: A_TEMPO, modo: 'separar' },
      mostrar: ['media'],
    });
    const linhas = cena.filter((p): p is Linha => p.tipo === 'linha' && p.papel === 'medida');
    expect(linhas).toHaveLength(3);
    const w = layout.largura / 3;
    expect(linhas.map((l) => [l.x1, l.x2])).toEqual([[0, w], [w, 2 * w], [2 * w, 3 * w]]);
    expect(linhas[0]!.y1).toBeGreaterThan(linhas[1]!.y1); // média de A (1,25) é menor, logo mais embaixo
    expect(linhas[1]!.y1).toBeGreaterThan(linhas[2]!.y1);
    expect(textos(cena, 'rotulo-medida')).toEqual(['média 1,25', 'média 6,25', 'média 10']);
  });

  it('sem linhas para dois eixos numéricos ou nenhum numérico', () => {
    expect(montar({ x: { atributoId: A_TEMPO, modo: 'separar' }, y: { atributoId: A_IDADE, modo: 'separar' }, mostrar: ['media'] }).cena.some((p) => p.papel === 'medida')).toBe(false);
    expect(montar({ x: { atributoId: A_MEIO, modo: 'separar' }, mostrar: ['media'] }).cena.some((p) => p.papel === 'medida')).toBe(false);
  });

  it('contagem e porcentagem por categoria (vírgula decimal)', () => {
    const { cena } = montar({ x: { atributoId: A_MEIO, modo: 'separar' }, mostrar: ['contagem'] });
    expect(textos(cena, 'contagem')).toEqual(['2', '2', '2']);
    const m2 = montar({ x: { atributoId: A_MEIO, modo: 'separar' }, mostrar: ['porcentagem'] });
    expect(textos(m2.cena, 'contagem')).toEqual(['33,3%', '33,3%', '33,3%']);
    const m3 = montar({ x: { atributoId: A_MEIO, modo: 'separar' }, mostrar: ['contagem', 'porcentagem'] });
    expect(textos(m3.cena, 'contagem')).toEqual(['2 (33,3%)', '2 (33,3%)', '2 (33,3%)']);
    expect(formatarPorcentagem(50)).toBe('50%');
  });

  it('contagem por intervalo inclui intervalos vazios', () => {
    const { cena } = montar({ x: { atributoId: A_TEMPO, modo: 'intervalos', intervalos: { largura: 2 } }, mostrar: ['contagem'] });
    // 0..10 em largura 2: [0,2[:1  [2,4[:1  [4,6[:1  [6,8[:1  [8,10]:2
    expect(textos(cena, 'contagem')).toEqual(['1', '1', '1', '1', '2']);
    const vazio = montar({ x: { atributoId: A_TEMPO, modo: 'intervalos', intervalos: { largura: 1 } }, mostrar: ['contagem'] });
    expect(textos(vazio.cena, 'contagem').filter((t) => t === '0').length).toBeGreaterThan(0);
  });

  it('contagem em duas dimensões ignora células vazias; na nuvem mostra o total', () => {
    const m = montar({ x: { atributoId: A_MEIO, modo: 'separar' }, y: { atributoId: A_IDADE, modo: 'intervalos', intervalos: { largura: 2 } }, mostrar: ['contagem'] });
    const t = textos(m.cena, 'contagem');
    expect(t.every((x) => x !== '0')).toBe(true);
    expect(t.map(Number).reduce((a, b) => a + b, 0)).toBe(6);
    expect(textos(montar({ mostrar: ['contagem'] }).cena, 'contagem')).toEqual(['6']);
  });
});

describe('cena: legenda', () => {
  it('legenda categórica vira retângulos e textos', () => {
    const { cores, legenda } = calcularCores(colecaoPequena(), colecaoPequena().casos, A_MEIO);
    expect(legenda?.tipo).toBe('categorica');
    expect(cores[0]).toBe(PALETA_CATEGORICA[0]);
    expect(cores[2]).toBe(PALETA_CATEGORICA[1]);
    const prim = primitivasDaLegenda(legenda!, 0, 0);
    expect(prim.filter((p) => p.tipo === 'retangulo')).toHaveLength(3);
  });
});

describe('cores', () => {
  it('paleta categórica distinta e sem repetição nas primeiras 20 categorias', () => {
    const cores = Array.from({ length: 20 }, (_, i) => corDaCategoria(i));
    expect(new Set(cores).size).toBe(20);
  });

  it('gradiente numérico: extremos, nulos em cinza e legenda com min e max', () => {
    const col = colecaoPequena();
    col.casos[1]!.valores[A_TEMPO] = null;
    const { cores, legenda } = calcularCores(col, col.casos, A_TEMPO);
    expect(cores[0]).toBe(corDoGradiente(0));
    expect(cores[4]).toBe(corDoGradiente(1));
    expect(cores[1]).toBe(COR_SEM_VALOR);
    expect(legenda).toMatchObject({ tipo: 'gradiente', minimo: 0, maximo: 10, rotuloMinimo: '0', rotuloMaximo: '10', temSemValor: true });
    expect(corDoGradiente(0)).not.toBe(corDoGradiente(1));
    expect(corDoGradiente(NaN)).toBe(corDoGradiente(0));
  });

  it('sem corPor: cor única e sem legenda; atributo inexistente também', () => {
    const col = colecaoPequena();
    expect(calcularCores(col, col.casos, undefined).legenda).toBeNull();
    expect(new Set(calcularCores(col, col.casos, 'nao-existe').cores).size).toBe(1);
  });
});

describe('filtro por fórmula', () => {
  it('filtra, ignora ocultos, e erros voltam em português sem filtrar', () => {
    const col = colecaoPequena();
    col.casos[5]!.oculto = true;
    expect(aplicarFiltro(col, undefined).casos).toHaveLength(5);
    expect(aplicarFiltro(col, '  ').filtrando).toBe(false);
    const ok = aplicarFiltro(col, 'Meio = "B"');
    expect(ok.casos.map((c) => c.id)).toEqual(['c2', 'c3']);
    expect(ok.erro).toBeNull();
    const ruim = aplicarFiltro(col, 'Tempo >');
    expect(ruim.erro).toBeTruthy();
    expect(ruim.casos).toHaveLength(5);
    expect(aplicarFiltro(col, 'Altura > 2').erro).toBe("Não achei o atributo 'Altura'");
    expect(aplicarFiltro(col, 'Tempo / 0 > 1').erro).toBe('Não dá para dividir por zero');
  });
});

describe('layout', () => {
  it('nuvem é reproduzível pela semente, dentro da área, e estável ao filtrar', () => {
    const col = colecaoPequena();
    const todos = col.casos.map((c) => c.id);
    const a = calcularNuvem(col, todos, 400, 300, 5, 12);
    const b = calcularNuvem(col, todos, 400, 300, 5, 12);
    const c = calcularNuvem(col, todos, 400, 300, 6, 12);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
    for (let i = 0; i < a.length; i += 2) {
      expect(a[i]).toBeGreaterThanOrEqual(6);
      expect(a[i]).toBeLessThanOrEqual(394);
      expect(a[i + 1]).toBeGreaterThanOrEqual(6);
      expect(a[i + 1]).toBeLessThanOrEqual(294);
    }
    const parcial = calcularNuvem(col, ['c3', 'c1'], 400, 300, 5, 12);
    expect([parcial[0], parcial[1]]).toEqual([a[6], a[7]]);
    expect([parcial[2], parcial[3]]).toEqual([a[2], a[3]]);
  });

  it('margens crescem com rótulos longos no eixo Y e a área tem tamanho mínimo', () => {
    const col = colecaoPequena();
    const curto = calcularMargem(estadoCom({ y: { atributoId: A_MEIO, modo: 'separar' } }), col);
    col.casos[0]!.valores[A_MEIO] = 'Transporte escolar municipal';
    const longo = calcularMargem(estadoCom({ y: { atributoId: A_MEIO, modo: 'separar' } }), col);
    expect(longo.esq).toBeGreaterThan(curto.esq);
    expect(areaInterna(10, 10, longo)).toEqual({ largura: 60, altura: 60 });
  });

  it('estado referencia atributo que não existe mais: eixo ignorado (nuvem)', () => {
    const { layout } = montar({ x: { atributoId: 'sumiu', modo: 'separar' } });
    expect(layout.nuvem).toBe(true);
  });
});

describe('paleta categórica (contraste e distinção)', () => {
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (h: string) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
  const lab = (h: string) => {
    const [r, g, b] = rgb(h).map(lin) as [number, number, number];
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)] as const;
  };
  const de = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]!));

  it('não usa o amarelo #F0E442 e o amarelo escurecido tem 3:1 com branco', () => {
    expect(PALETA_CATEGORICA.map((c) => c.toLowerCase())).not.toContain('#f0e442');
    const amarelo = PALETA_CATEGORICA[6]!;
    expect((1.05) / (lum(amarelo) + 0.05)).toBeGreaterThanOrEqual(3);
  });

  it('todas as cores ficam a ΔE >= 20 (Lab) umas das outras', () => {
    for (let i = 0; i < PALETA_CATEGORICA.length; i++) {
      for (let j = i + 1; j < PALETA_CATEGORICA.length; j++) {
        expect(de(PALETA_CATEGORICA[i]!, PALETA_CATEGORICA[j]!)).toBeGreaterThanOrEqual(20);
      }
    }
  });
});
