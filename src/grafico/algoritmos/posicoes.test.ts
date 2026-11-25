import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calcularPosicoes, EIXO_NENHUM, mulberry32, posicoesIniciais, type ConfigEixo, type ConfigPosicoes } from './posicoes';

/** Execuções das propriedades: padrão do teste, ou FC_NUM_RUNS (e FC_SEED) para varreduras longas. */
const rodadas = (padrao: number): { numRuns: number; seed?: number } => ({
  numRuns: Number(process.env.FC_NUM_RUNS) || padrao,
  ...(process.env.FC_SEED ? { seed: Number(process.env.FC_SEED) } : {}),
});

const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);
const base = { largura: 600, altura: 400, diametro: 10 };
const cat = (valores: (string | null)[], extra: Partial<ConfigEixo> = {}): ConfigEixo => ({ tipo: 'categorico', valores, ...extra });
const num = (valores: (number | null)[], extra: Partial<ConfigEixo> = {}): ConfigEixo => ({ tipo: 'numerico', valores, ...extra });

function dentro(r: ReturnType<typeof calcularPosicoes>, W: number, H: number, d: number) {
  const rd = Math.min(d / 2, W / 2, H / 2);
  for (const p of r.pontos) {
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(rd - 1e-9);
    expect(p.x).toBeLessThanOrEqual(W - rd + 1e-9);
    expect(p.y).toBeGreaterThanOrEqual(rd - 1e-9);
    expect(p.y).toBeLessThanOrEqual(H - rd + 1e-9);
  }
}

describe('calcularPosicoes: bordas', () => {
  it('vazio', () => {
    const r = calcularPosicoes({ ids: [], x: num([]), y: cat([]), ...base });
    expect(r.pontos).toEqual([]);
  });
  it('um ponto, sem eixos: no centro', () => {
    const r = calcularPosicoes({ ids: ['a'], x: EIXO_NENHUM, y: EIXO_NENHUM, ...base });
    expect(r.pontos[0]).toEqual({ id: 'a', x: 300, y: 200 });
  });
  it('um ponto em eixo numérico; valores iguais ficam no centro do eixo', () => {
    const r = calcularPosicoes({ ids: ids(3), x: num([4, 4, 4]), y: EIXO_NENHUM, ...base });
    expect(r.pontos.map((p) => p.x)).toEqual([300, 300, 300]);
    expect(r.eixoX.marcas.map((m) => m.rotulo)).toEqual(['4']);
  });
  it('numérico separar: mínimo e máximo nas extremidades; Y cresce para cima', () => {
    const r = calcularPosicoes({ ids: ids(3), x: num([0, 5, 10]), y: num([0, 5, 10]), ...base });
    expect(r.pontos[0]).toEqual({ id: 'c0', x: 5, y: 395 });
    expect(r.pontos[2]).toEqual({ id: 'c2', x: 595, y: 5 });
    expect(r.eixoX.marcas[0]).toEqual({ posicao: 5, rotulo: '0' });
  });
  it('nulos vão para a faixa "sem valor" no fim do eixo', () => {
    const r = calcularPosicoes({ ids: ids(3), x: num([0, null, 10]), y: EIXO_NENHUM, ...base });
    expect(r.eixoX.semValor).not.toBeNull();
    expect(r.pontos[1]!.x).toBeGreaterThan(r.pontos[0]!.x);
    expect(r.pontos[1]!.x).toBeGreaterThanOrEqual(r.eixoX.semValor!.ini);
    expect(r.pontos[2]!.x).toBeLessThan(r.eixoX.semValor!.ini);
    dentro(r, 600, 400, 10);
  });
  it('todos nulos', () => {
    const r = calcularPosicoes({ ids: ids(2), x: num([null, null]), y: cat([null, null]), ...base });
    dentro(r, 600, 400, 10);
  });
  it('categórico com categorias de um só caso: colunas iguais e rótulos', () => {
    const r = calcularPosicoes({ ids: ids(3), x: cat(['a', 'b', 'c']), y: EIXO_NENHUM, ...base });
    expect(r.pontos.map((p) => p.x)).toEqual([100, 300, 500]);
    expect(r.eixoX.marcas.map((m) => m.rotulo)).toEqual(['a', 'b', 'c']);
  });
  it('categórico empilhar: pilha a partir da base', () => {
    const r = calcularPosicoes({ ids: ids(3), x: cat(['a', 'a', 'a'], { modo: 'empilhar' }), y: EIXO_NENHUM, ...base });
    expect(r.pontos.map((p) => p.y)).toEqual([395, 385, 375]);
  });
  it('numérico empilhar: valores iguais formam pilha; Y vazio', () => {
    const r = calcularPosicoes({ ids: ids(4), x: num([1, 1, 5, 9], { modo: 'empilhar' }), y: EIXO_NENHUM, ...base });
    expect(r.pontos[0]!.x).toBe(r.pontos[1]!.x);
    expect(r.pontos[0]!.y).toBeGreaterThan(r.pontos[1]!.y);
  });
  it('intervalos: máximo exatamente no limite cai no último intervalo; rótulos', () => {
    const r = calcularPosicoes({
      ids: ids(4), x: num([10, 20, 30, 40], { modo: 'intervalos', larguraIntervalo: 10 }), y: EIXO_NENHUM, ...base,
    });
    expect(r.eixoX.faixas.map((f) => f.rotulo)).toEqual(['[10; 20[', '[20; 30[', '[30; 40]']);
    expect(r.pontos[2]!.x).toBe(r.pontos[3]!.x); // 30 e 40 no mesmo intervalo
    expect(r.pontos[2]!.y).not.toBe(r.pontos[3]!.y);
    expect(r.eixoX.marcas.map((m) => m.rotulo)).toEqual(['10', '20', '30', '40']);
  });
  it('intervalos com vírgula decimal (padrão pt-BR)', () => {
    const r = calcularPosicoes({
      ids: ids(2), x: num([0.5, 1.5], { modo: 'intervalos', larguraIntervalo: 0.5 }), y: EIXO_NENHUM, ...base,
    });
    expect(r.eixoX.faixas.at(-1)!.rotulo).toBe('[1; 1,5]');
  });
  it('dois eixos categóricos: grade por célula', () => {
    const r = calcularPosicoes({
      ids: ids(4), x: cat(['a', 'a', 'b', 'b']), y: cat(['u', 'v', 'u', 'v']), ...base,
    });
    expect(r.pontos[0]!.x).toBe(150);
    expect(r.pontos[0]!.y).toBe(100);
    expect(r.pontos[3]).toMatchObject({ x: 450, y: 300 });
  });
  it('categórico × numérico empilhar: pilha dentro da faixa da categoria', () => {
    const r = calcularPosicoes({
      ids: ids(4), x: num([1, 1, 1, 1], { modo: 'empilhar' }), y: cat(['a', 'a', 'b', 'b']), ...base,
    });
    // linha de 'a' = [0,200], 'b' = [200,400]; base de cada linha é seu limite inferior
    expect(r.pontos[0]!.y).toBe(195);
    expect(r.pontos[1]!.y).toBe(185);
    expect(r.pontos[2]!.y).toBe(395);
  });
  it('categórico × numérico separar: espalha lateralmente sem sobrepor', () => {
    const r = calcularPosicoes({
      ids: ids(3), x: cat(['a', 'a', 'a']), y: num([5, 5, 5]), ...base,
    });
    const xs = r.pontos.map((p) => p.x);
    expect(new Set(xs).size).toBe(3);
  });
  it('Y numérico empilhar empilha da esquerda para a direita', () => {
    const r = calcularPosicoes({ ids: ids(3), x: EIXO_NENHUM, y: num([2, 2, 2], { modo: 'empilhar' }), ...base });
    expect(r.pontos.map((p) => p.x)).toEqual([5, 15, 25]);
  });
  it('ordenar numérico: igual e proporcional', () => {
    const a = calcularPosicoes({ ids: ids(3), x: num([1, 2, 100], { modo: 'ordenar' }), y: EIXO_NENHUM, ...base });
    expect(a.pontos.map((p) => p.x)).toEqual([5, 300, 595]);
    const b = calcularPosicoes({ ids: ids(3), x: num([0, 50, 100], { modo: 'ordenar', ordenarProporcional: true }), y: EIXO_NENHUM, ...base });
    expect(b.pontos.map((p) => p.x)).toEqual([5, 300, 595]);
    expect(b.eixoX.marcas.length).toBeGreaterThan(1);
  });
  it('ordenar categórico ordena pela ordem das categorias', () => {
    const r = calcularPosicoes({
      ids: ids(3), x: cat(['b', 'a', 'b'], { modo: 'ordenar', ordemCategorias: ['a', 'b'] }), y: EIXO_NENHUM, ...base,
    });
    expect(r.pontos[1]!.x).toBeLessThan(r.pontos[0]!.x);
    expect(r.pontos[0]!.x).toBeLessThan(r.pontos[2]!.x);
  });
  it('domínio explícito', () => {
    const r = calcularPosicoes({ ids: ids(1), x: num([50], { dominio: [0, 100] }), y: EIXO_NENHUM, ...base });
    expect(r.pontos[0]!.x).toBe(300);
    expect(r.eixoX.dominio).toEqual([0, 100]);
  });
  it('último recurso devolve fatorIcone < 1', () => {
    const r = calcularPosicoes({
      ids: ids(2000), x: cat(new Array(2000).fill('a'), { modo: 'empilhar' }), y: EIXO_NENHUM, largura: 100, altura: 100, diametro: 10,
    });
    expect(r.fatorIcone).toBeLessThan(1);
    dentro(r, 100, 100, 10);
  });
});

describe('calcularPosicoes: regressões de propriedades instáveis', () => {
  it('pilha comprimida com ícone reduzido: o recorte às bordas não pode apertar o passo (contraexemplo [[3,3,3,3,3,0],100,50,17])', () => {
    const v = [3, 3, 3, 3, 3, 0];
    const r = calcularPosicoes({ ids: ids(6), x: num(v, { modo: 'empilhar' }), y: EIXO_NENHUM, largura: 100, altura: 50, diametro: 17 });
    const de = r.diametroEfetivo;
    expect(de).toBeLessThan(17); // houve redução do ícone
    const pilha = r.pontos.slice(0, 5).map((p) => p.y).sort((a, b) => b - a);
    for (let i = 1; i < pilha.length; i++) expect(pilha[i - 1]! - pilha[i]!).toBeGreaterThanOrEqual(0.5 * de - 1e-9);
    dentro(r, 100, 50, 17); // e nada saiu da área (margem nominal de meio diâmetro)
  });
  it('amplitude de ~1 ulp em eixo numérico: termina rápido, sem RangeError (marcasBonitas)', () => {
    const t0 = performance.now();
    for (const modo of ['separar', 'ordenar', 'empilhar', 'intervalos'] as const) {
      const r = calcularPosicoes({
        ids: ids(3), x: num([1000 - 2.2737367544323206e-13, 1000, 1000], { modo, ordenarProporcional: true }), y: EIXO_NENHUM, ...base,
      });
      expect(r.pontos).toHaveLength(3);
      dentro(r, 600, 400, 10);
    }
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});

describe('posicoesIniciais', () => {
  it('reproduzível pela semente e dentro da área', () => {
    const a = posicoesIniciais(ids(50), 300, 200, 42, 10);
    const b = posicoesIniciais(ids(50), 300, 200, 42, 10);
    const c = posicoesIniciais(ids(50), 300, 200, 43, 10);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(5);
      expect(p.x).toBeLessThanOrEqual(295);
      expect(p.y).toBeGreaterThanOrEqual(5);
      expect(p.y).toBeLessThanOrEqual(195);
    }
  });
  it('vazio e mulberry32 em [0,1)', () => {
    expect(posicoesIniciais([], 10, 10, 1)).toEqual([]);
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('calcularPosicoes: propriedades', () => {
  const modoArb = fc.constantFrom('separar', 'ordenar', 'empilhar', 'intervalos') as fc.Arbitrary<ConfigEixo['modo']>;
  const eixoArb = (n: number): fc.Arbitrary<ConfigEixo> =>
    fc.oneof(
      fc.constant<ConfigEixo>(EIXO_NENHUM),
      fc.record({
        tipo: fc.constant('categorico' as const),
        modo: modoArb,
        valores: fc.array(fc.option(fc.constantFrom('a', 'b', 'c', 'd'), { nil: null }), { minLength: n, maxLength: n }),
      }),
      fc.record({
        tipo: fc.constant('numerico' as const),
        modo: modoArb,
        valores: fc.array(fc.option(fc.double({ min: -1000, max: 1000, noNaN: true }), { nil: null }), { minLength: n, maxLength: n }),
      }),
    ) as fc.Arbitrary<ConfigEixo>;
  it('nenhuma posição fora da área, para qualquer combinação de eixos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 150 }).chain((n) =>
          fc.record({ n: fc.constant(n), x: eixoArb(n), y: eixoArb(n) }),
        ),
        fc.integer({ min: 40, max: 900 }),
        fc.integer({ min: 40, max: 700 }),
        fc.integer({ min: 2, max: 30 }),
        ({ n, x, y }, largura, altura, diametro) => {
          const cfg: ConfigPosicoes = { ids: ids(n), x, y, largura, altura, diametro };
          const r = calcularPosicoes(cfg);
          expect(r.pontos).toHaveLength(n);
          dentro(r, largura, altura, diametro);
        },
      ),
      rodadas(300),
    );
  });
  it('empilhar numa pilha: sem sobreposição além do permitido (eixo X numérico, Y vazio)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 200 }),
        fc.integer({ min: 100, max: 800 }),
        fc.integer({ min: 50, max: 600 }),
        fc.integer({ min: 4, max: 20 }),
        (v, largura, altura, d) => {
          const r = calcularPosicoes({ ids: ids(v.length), x: num(v, { modo: 'empilhar' }), y: EIXO_NENHUM, largura, altura, diametro: d });
          const de = r.diametroEfetivo;
          for (let i = 0; i < v.length; i++)
            for (let j = i + 1; j < v.length; j++) {
              const a = r.pontos[i]!;
              const b = r.pontos[j]!;
              if (Math.abs(a.x - b.x) < 1e-9) expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(0.5 * de - 1e-9);
            }
        },
      ),
      rodadas(100),
    );
  });
});

describe('desempenho (mais de 5.000 pontos)', () => {
  const N = 6000;
  const rnd = mulberry32(1);
  const valores = Array.from({ length: N }, () => Math.round(rnd() * 1000) / 10);
  const cats = Array.from({ length: N }, () => ['a', 'b', 'c', 'd', 'e'][Math.floor(rnd() * 5)]!);
  const casos: [string, ConfigEixo, ConfigEixo][] = [
    ['sem eixos', EIXO_NENHUM, EIXO_NENHUM],
    ['categórico separar', cat(cats), EIXO_NENHUM],
    ['numérico empilhar', num(valores, { modo: 'empilhar' }), EIXO_NENHUM],
    ['intervalos', num(valores, { modo: 'intervalos' }), EIXO_NENHUM],
    ['numérico ordenar', num(valores, { modo: 'ordenar' }), EIXO_NENHUM],
    ['numérico × numérico', num(valores), num(valores.slice().reverse())],
    ['categórico × categórico', cat(cats), cat(cats.slice().reverse())],
    ['numérico empilhar × categórico', num(valores, { modo: 'empilhar' }), cat(cats)],
  ];
  for (const [nome, x, y] of casos) {
    it(`${nome}: ${N} pontos em tempo razoável`, () => {
      const t0 = performance.now();
      const r = calcularPosicoes({ ids: ids(N), x, y, largura: 900, altura: 600, diametro: 10 });
      const ms = performance.now() - t0;
      console.log(`[tempo] ${nome} (${N} pontos): ${ms.toFixed(1)} ms`);
      expect(r.pontos).toHaveLength(N);
      dentro(r, 900, 600, 10);
      expect(ms).toBeLessThan(1000);
    });
  }
  it('posicoesIniciais com 6000 pontos', () => {
    const t0 = performance.now();
    const r = posicoesIniciais(ids(N), 900, 600, 5, 10);
    console.log(`[tempo] posicoesIniciais (${N} pontos): ${(performance.now() - t0).toFixed(1)} ms`);
    expect(r).toHaveLength(N);
  });
});
