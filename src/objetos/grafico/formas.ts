// Formas dos pontos do gráfico: silhuetas originais (desenhadas para este programa), em coordenadas de -1 a 1 (y para baixo).
// Cada forma é uma lista de contornos preenchidos juntos (regra "não zero"): contornos no mesmo sentido se unem
// e um contorno no sentido contrário (ex.: o olho) vira um furo.
export type Contorno = ReadonlyArray<readonly [number, number]>;

export const FORMAS_ICONE = [
  'circulo', 'quadrado', 'triangulo', 'estrela', 'coracao', 'pessoa', 'peixe', 'passaro', 'pinguim', 'dinossauro', 'folha',
] as const;
export type FormaIcone = (typeof FORMAS_ICONE)[number];

const PASSOS = 20;

function areaComSinal(c: Contorno): number {
  let a = 0;
  for (let i = 0; i < c.length; i++) {
    const [x1, y1] = c[i]!;
    const [x2, y2] = c[(i + 1) % c.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Contorno no sentido positivo (união) ou, com `furo`, no sentido contrário. */
function orientar(c: Contorno, furo = false): Contorno {
  const positivo = areaComSinal(c) > 0;
  return positivo === !furo ? c : [...c].reverse();
}

function elipse(cx: number, cy: number, rx: number, ry: number, furo = false): Contorno {
  const pts: [number, number][] = [];
  for (let i = 0; i < PASSOS; i++) {
    const a = (2 * Math.PI * i) / PASSOS;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return orientar(pts, furo);
}

function poligono(...pts: [number, number][]): Contorno {
  return orientar(pts);
}

function estrela(): Contorno {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const r = i % 2 === 0 ? 1 : 0.45;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return orientar(pts);
}

function coracao(): Contorno {
  const pts: [number, number][] = [];
  for (let i = 0; i < 32; i++) {
    const t = (2 * Math.PI * i) / 32;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x / 19, (y + 2) / 19]);
  }
  return orientar(pts);
}

function folha(): Contorno {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    pts.push([-1 + 2 * s, -0.55 * Math.sin(Math.PI * s)]);
  }
  for (let i = 9; i >= 1; i--) {
    const s = i / 10;
    pts.push([-1 + 2 * s, 0.55 * Math.sin(Math.PI * s)]);
  }
  return orientar(pts.map(([x, y]) => [x * 0.95, y + x * 0.35] as [number, number]));
}

export const CONTORNOS: Record<FormaIcone, readonly Contorno[]> = {
  circulo: [elipse(0, 0, 1, 1)],
  quadrado: [poligono([-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9])],
  triangulo: [poligono([0, -1], [1, 0.85], [-1, 0.85])],
  estrela: [estrela()],
  coracao: [coracao()],
  pessoa: [elipse(0, -0.62, 0.34, 0.34), elipse(0, 0.35, 0.6, 0.62), poligono([-0.6, 0.2], [0.6, 0.2], [0.75, 1], [-0.75, 1])],
  peixe: [elipse(-0.1, 0, 0.72, 0.5), poligono([-0.55, 0], [-1, -0.55], [-1, 0.55]), elipse(0.35, -0.12, 0.09, 0.09, true)],
  passaro: [
    elipse(-0.1, 0.15, 0.6, 0.42), elipse(0.5, -0.3, 0.3, 0.3), poligono([0.75, -0.38], [1, -0.25], [0.75, -0.15]),
    poligono([-0.55, 0.05], [-1, -0.3], [-0.95, 0.25]), elipse(0.58, -0.36, 0.06, 0.06, true),
  ],
  pinguim: [
    elipse(0, 0.2, 0.55, 0.78), elipse(0, -0.68, 0.36, 0.34), poligono([0.3, -0.7], [0.7, -0.58], [0.3, -0.5]),
    elipse(-0.25, 0.98, 0.2, 0.08), elipse(0.25, 0.98, 0.2, 0.08), elipse(0.1, -0.78, 0.06, 0.06, true),
  ],
  dinossauro: [
    elipse(-0.15, 0.15, 0.6, 0.36), poligono([0.2, 0.05], [0.5, -0.75], [0.78, -0.75], [0.5, 0.25]), elipse(0.8, -0.78, 0.22, 0.14),
    poligono([-0.6, 0.0], [-1, 0.45], [-0.55, 0.3]), poligono([-0.5, 0.4], [-0.3, 0.4], [-0.3, 0.98], [-0.5, 0.98]),
    poligono([0.1, 0.4], [0.3, 0.4], [0.3, 0.98], [0.1, 0.98]), elipse(0.86, -0.82, 0.04, 0.04, true),
  ],
  folha: [folha()],
};

/** Caminho SVG da forma (para os botões do painel), numa caixa 24×24. */
export function caminhoSvg(forma: FormaIcone): string {
  return CONTORNOS[forma]
    .map((c) => `M${c.map(([x, y]) => `${(12 + x * 10).toFixed(2)} ${(12 + y * 10).toFixed(2)}`).join('L')}Z`)
    .join('');
}

/** Acrescenta a forma ao caminho atual do canvas, centrada em (x, y) com "raio" r. */
export function acrescentarForma(ctx: CanvasRenderingContext2D, forma: FormaIcone, x: number, y: number, r: number): void {
  if (forma === 'circulo') {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  for (const c of CONTORNOS[forma]) {
    c.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(x + px * r, y + py * r);
      else ctx.lineTo(x + px * r, y + py * r);
    });
    ctx.closePath();
  }
}
