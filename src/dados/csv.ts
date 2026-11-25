import { criarAtributo, criarCaso, criarColecao } from '../modelo/fabrica';
import type { Atributo, Colecao, TipoAtributo, ValorCelula } from '../modelo/tipos';

/** Limites de segurança: um CSV maior que isso provavelmente não é para uma sala de aula. */
export const MAX_LINHAS_CSV = 5000;
export const MAX_COLUNAS_CSV = 40;

export class ErroCsv extends Error {}

function detectarSeparador(primeiraLinha: string): string {
  const cont = (c: string) => primeiraLinha.split(c).length - 1;
  const candidatos = [';', '\t', ','].map((c) => [c, cont(c)] as const);
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0]![1] > 0 ? candidatos[0]![0] : ',';
}

/** Lê CSV com aspas ("a,b", "" como aspas literais) e quebras de linha dentro de campos. */
export function lerCsv(texto: string): { separador: string; linhas: string[][] } {
  const limpo = texto.replace(/^﻿/, '');
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? '';
  const sep = detectarSeparador(primeira);
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]!;
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"' && campo === '') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
      linha = [];
      if (linhas.length > MAX_LINHAS_CSV + 1) throw new ErroCsv(`O arquivo tem mais de ${MAX_LINHAS_CSV} linhas.`);
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
  return { separador: sep, linhas };
}

const AUSENTES = new Set(['', 'na', 'n/a', 'nan', 'null', '-', '?']);

function comoNumero(valor: string, virgulaDecimal: boolean): number | null {
  const v = valor.trim();
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(v)) return null;
  const n = Number(virgulaDecimal ? v.replace(',', '.') : v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Transforma um CSV (com linha de cabeçalho) em coleção. Tipos: número, categoria (poucos valores repetidos) ou texto. */
export function colecaoDeCsv(texto: string, nome: string): Colecao {
  const { separador, linhas } = lerCsv(texto);
  if (linhas.length < 2) throw new ErroCsv('O arquivo precisa ter uma linha de títulos e pelo menos uma linha de dados.');
  const cab = linhas[0]!.map((x) => x.trim());
  if (cab.length > MAX_COLUNAS_CSV) throw new ErroCsv(`O arquivo tem mais de ${MAX_COLUNAS_CSV} colunas.`);
  const dados = linhas.slice(1);
  const virgula = separador === ';';
  const usados = new Set<string>();
  const atributos: Atributo[] = cab.map((titulo, j) => {
    let base = titulo || `Coluna ${j + 1}`;
    let n = base; let k = 2;
    while (usados.has(n)) n = `${base} (${k++})`;
    usados.add(n);
    const col = dados.map((l) => (l[j] ?? '').trim()).filter((v) => !AUSENTES.has(v.toLowerCase()));
    let tipo: TipoAtributo = 'texto';
    if (col.length > 0 && col.every((v) => comoNumero(v, virgula) !== null)) tipo = 'numerico';
    else if (new Set(col).size <= Math.min(24, Math.max(2, Math.floor(dados.length / 2)))) tipo = 'categorico';
    return criarAtributo({ nome: n, tipo, indiceCor: j });
  });
  const casos = dados.map((l) => {
    const valores: Record<string, ValorCelula> = {};
    atributos.forEach((a, j) => {
      const bruto = (l[j] ?? '').trim();
      if (AUSENTES.has(bruto.toLowerCase())) valores[a.id] = null;
      else valores[a.id] = a.tipo === 'numerico' ? comoNumero(bruto, virgula) : bruto;
    });
    return criarCaso(valores);
  });
  return criarColecao(nome, atributos, casos);
}
