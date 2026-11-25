// Gera o ícone do Investigando (desenho original, sem material de terceiros):
// squircle branco com contorno índigo e um gráfico de pontos (dot plot) em cores de dados.
// Uso: node src-tauri/gerar-icones.mjs   (escreve src-tauri/icons/* e public/favicon.svg)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pastaIcones = join(raiz, 'src-tauri', 'icons');
const pastaPublic = join(raiz, 'public');
mkdirSync(pastaIcones, { recursive: true });
mkdirSync(pastaPublic, { recursive: true });

// Geometria em uma grade de 1024 x 1024.
// Marca: círculo de pontos em anéis concêntricos (cada ponto é um caso da pesquisa),
// um deles em laranja (o achado), sobre squircle índigo. Desenho original.
const INDIGO = [0x16, 0x11, 0x5e];
const LAVANDA = [0xd6, 0xd4, 0xf8];
const LARANJA = [0xff, 0x6a, 0x1f];
const C = 512, R = 412, N = 5;
/** Pontos da marca: aneis, passo e raio na grade 1024; destaque no anel externo, indice 4. */
function pontosDaMarca(aneis, passo, raio) {
  const lista = [{ x: C, y: C, raio, destaque: false }];
  for (let k = 1; k <= aneis; k++) {
    const n = 6 * k;
    for (let i = 0; i < n; i++) {
      const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
      lista.push({ x: C + k * passo * Math.cos(a), y: C + k * passo * Math.sin(a), raio, destaque: k === aneis && i === Math.round(n / 6.5) });
    }
  }
  return lista;
}
const GRANDE = pontosDaMarca(4, 74, 29);   // 128 px ou mais
const PEQUENA = pontosDaMarca(3, 104, 46); // 64 px ou menos
let pontos = GRANDE;

const dentroSquircle = (x, y, r) => (Math.abs(x - C) / r) ** N + (Math.abs(y - C) / r) ** N <= 1;

/** Cor de um ponto da grade 1024 (ou null fora do squircle). */
function amostra(x, y) {
  if (!dentroSquircle(x, y, R)) return null;
  for (const p of pontos) if (Math.hypot(x - p.x, y - p.y) <= p.raio) return p.destaque ? LARANJA : LAVANDA;
  return INDIGO;
}

function renderizar(n, ss = 4) {
  const buf = Buffer.alloc(n * n * 4);
  const k = 1024 / n;
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = amostra((px + (sx + 0.5) / ss) * k, (py + (sy + 0.5) / ss) * k);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = (py * n + px) * 4;
      if (a) { buf[o] = Math.round(r / a); buf[o + 1] = Math.round(g / a); buf[o + 2] = Math.round(b / a); buf[o + 3] = Math.round((255 * a) / (ss * ss)); }
    }
  }
  return buf;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}
const cache = new Map();
function png(n) {
  if (cache.has(n)) return cache.get(n);
  pontos = n <= 64 ? PEQUENA : GRANDE;
  const rgba = renderizar(n);
  const linhas = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) rgba.copy(linhas, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  const dados = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(linhas, { level: 9 })), bloco('IEND', Buffer.alloc(0))]);
  cache.set(n, dados);
  return dados;
}

// PNGs do Tauri
writeFileSync(join(pastaIcones, '32x32.png'), png(32));
writeFileSync(join(pastaIcones, '64x64.png'), png(64));
writeFileSync(join(pastaIcones, '128x128.png'), png(128));
writeFileSync(join(pastaIcones, '128x128@2x.png'), png(256));
writeFileSync(join(pastaIcones, 'icon.png'), png(512));

// .ico com PNGs embutidos (16 a 256)
const tamIco = [16, 24, 32, 48, 64, 128, 256];
const cab = Buffer.alloc(6); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(tamIco.length, 4);
let desloc = 6 + 16 * tamIco.length;
const dir = tamIco.map((n) => {
  const d = png(n), e = Buffer.alloc(16);
  e[0] = n >= 256 ? 0 : n; e[1] = n >= 256 ? 0 : n; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(d.length, 8); e.writeUInt32LE(desloc, 12); desloc += d.length; return e;
});
writeFileSync(join(pastaIcones, 'icon.ico'), Buffer.concat([cab, ...dir, ...tamIco.map((n) => png(n))]));

// .icns com PNGs embutidos
const tiposIcns = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
  ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]];
const itens = tiposIcns.map(([t, n]) => {
  const d = png(n), h = Buffer.alloc(8); h.write(t, 0, 'ascii'); h.writeUInt32BE(d.length + 8, 4); return Buffer.concat([h, d]);
});
const ch = Buffer.alloc(8); ch.write('icns', 0, 'ascii'); ch.writeUInt32BE(8 + itens.reduce((s, b) => s + b.length, 0), 4);
writeFileSync(join(pastaIcones, 'icon.icns'), Buffer.concat([ch, ...itens]));

// favicon.svg e marca.svg (mesma geometria)
const poli = (r) => Array.from({ length: 180 }, (_, i) => {
  const t = (i / 180) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
  const x = C + r * Math.sign(c) * Math.abs(c) ** (2 / N), y = C + r * Math.sign(s) * Math.abs(s) ** (2 / N);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');
const corHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const circulos = (lista, base, destaque) => lista.map((p) =>
  `  <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.raio}" fill="${p.destaque ? destaque : base}"/>`).join('\n');
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <title>Investigando</title>
  <polygon points="${poli(R)}" fill="${corHex(INDIGO)}"/>
${circulos(PEQUENA, corHex(LAVANDA), corHex(LARANJA))}
</svg>
`;
writeFileSync(join(pastaPublic, 'favicon.svg'), favicon);
// marca sem fundo, para a barra do app (pontos em índigo; currentColor não é usado para manter o laranja)
const marca = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="212 212 600 600">
  <title>Investigando</title>
${circulos(GRANDE, corHex(INDIGO), corHex(LARANJA))}
</svg>
`;
writeFileSync(join(pastaPublic, 'marca.svg'), marca);
console.log('Ícones gerados em', pastaIcones, 'e em', pastaPublic);
