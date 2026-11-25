import { ErroFormula } from './erro';

export type TipoToken = 'num' | 'txt' | 'bool' | 'id' | 'ref' | 'op' | 'abre' | 'fecha' | 'sep' | 'fim';

export interface Token {
  tipo: TipoToken;
  texto: string;
  valor?: number | string | boolean;
  inicio: number;
  fim: number;
}

const PALAVRAS_OP: Record<string, string> = {
  e: 'e', and: 'e', ou: 'ou', or: 'ou', 'não': 'nao', nao: 'nao', not: 'nao',
};
const PALAVRAS_BOOL: Record<string, boolean> = { verdadeiro: true, true: true, falso: false, false: false };

const OPERADORES: [string, string][] = [
  ['<>', '<>'], ['!=', '<>'], ['≠', '<>'], ['<=', '<='], ['≤', '<='], ['>=', '>='], ['≥', '>='], ['==', '='],
  ['+', '+'], ['-', '-'], ['−', '-'], ['–', '-'], ['*', '*'], ['×', '*'], ['/', '/'], ['÷', '/'],
  ['^', '^'], ['&', '&'], ['=', '='], ['<', '<'], ['>', '>'],
];

const ehLetra = (c: string) => /[\p{L}_]/u.test(c);
const ehDigito = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';

type ModoVirgula = 'decimal' | 'separador';

function modosDosParenteses(fonte: string): Map<number, ModoVirgula> {
  const modos = new Map<number, ModoVirgula>();
  const pilha: { pos: number; chamada: boolean; temPontoEVirgula: boolean }[] = [];
  for (let i = 0; i < fonte.length; i++) {
    const c = fonte[i]!;
    if (c === '"' || c === "'") {
      const fim = fonte.indexOf(c, i + 1);
      if (fim === -1) break;
      i = fim;
    } else if (c === '[') {
      const fim = fonte.indexOf(']', i + 1);
      if (fim === -1) break;
      i = fim;
    } else if (c === '(') {
      const anterior = fonte.slice(0, i).trimEnd().slice(-1);
      pilha.push({ pos: i, chamada: anterior !== '' && /[\p{L}\p{N}_]/u.test(anterior), temPontoEVirgula: false });
    } else if (c === ';') {
      const topo = pilha[pilha.length - 1];
      if (topo) topo.temPontoEVirgula = true;
    } else if (c === ')') {
      const topo = pilha.pop();
      if (topo) modos.set(topo.pos, topo.chamada && !topo.temPontoEVirgula ? 'separador' : 'decimal');
    }
  }
  for (const aberto of pilha) modos.set(aberto.pos, aberto.chamada && !aberto.temPontoEVirgula ? 'separador' : 'decimal');
  return modos;
}

export function tokenizar(fonte: string): Token[] {
  const tokens: Token[] = [];
  const modos = modosDosParenteses(fonte);
  const pilha: ModoVirgula[] = [];
  let i = 0;

  while (i < fonte.length) {
    const c = fonte[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (ehDigito(c)) {
      const inicio = i;
      while (ehDigito(fonte[i])) i++;
      const separadorDecimal = fonte[i];
      const modoAtual = pilha[pilha.length - 1];
      const virgulaDecimal = separadorDecimal === ',' && modoAtual !== 'separador';
      if ((separadorDecimal === '.' || virgulaDecimal) && ehDigito(fonte[i + 1])) {
        i++;
        while (ehDigito(fonte[i])) i++;
      }
      const texto = fonte.slice(inicio, i);
      tokens.push({ tipo: 'num', texto, valor: Number(texto.replace(',', '.')), inicio, fim: i });
      continue;
    }

    if (c === '"' || c === "'") {
      const fim = fonte.indexOf(c, i + 1);
      if (fim === -1) throw new ErroFormula('Faltou fechar as aspas do texto', i, fonte.length);
      tokens.push({ tipo: 'txt', texto: fonte.slice(i, fim + 1), valor: fonte.slice(i + 1, fim), inicio: i, fim: fim + 1 });
      i = fim + 1;
      continue;
    }

    if (c === '[') {
      const fim = fonte.indexOf(']', i + 1);
      if (fim === -1) throw new ErroFormula('Faltou fechar o colchete do nome do atributo', i, fonte.length);
      const nome = fonte.slice(i + 1, fim).trim();
      if (nome === '') throw new ErroFormula('O nome entre colchetes está vazio', i, fim + 1);
      tokens.push({ tipo: 'ref', texto: fonte.slice(i, fim + 1), valor: nome, inicio: i, fim: fim + 1 });
      i = fim + 1;
      continue;
    }

    if (ehLetra(c)) {
      const inicio = i;
      while (i < fonte.length && /[\p{L}\p{N}_]/u.test(fonte[i]!)) i++;
      const texto = fonte.slice(inicio, i);
      const minusculo = texto.toLowerCase();
      if (minusculo in PALAVRAS_OP) {
        tokens.push({ tipo: 'op', texto, valor: PALAVRAS_OP[minusculo], inicio, fim: i });
      } else if (minusculo in PALAVRAS_BOOL) {
        tokens.push({ tipo: 'bool', texto, valor: PALAVRAS_BOOL[minusculo], inicio, fim: i });
      } else {
        tokens.push({ tipo: 'id', texto, valor: texto, inicio, fim: i });
      }
      continue;
    }

    if (c === '(') {
      pilha.push(modos.get(i) ?? 'decimal');
      tokens.push({ tipo: 'abre', texto: c, inicio: i, fim: i + 1 });
      i++;
      continue;
    }
    if (c === ')') {
      pilha.pop();
      tokens.push({ tipo: 'fecha', texto: c, inicio: i, fim: i + 1 });
      i++;
      continue;
    }
    if (c === ',' || c === ';') {
      tokens.push({ tipo: 'sep', texto: c, inicio: i, fim: i + 1 });
      i++;
      continue;
    }

    const op = OPERADORES.find(([texto]) => fonte.startsWith(texto, i));
    if (op) {
      tokens.push({ tipo: 'op', texto: op[0], valor: op[1], inicio: i, fim: i + op[0].length });
      i += op[0].length;
      continue;
    }

    throw new ErroFormula(`Não entendi o símbolo '${c}'`, i, i + 1);
  }

  tokens.push({ tipo: 'fim', texto: '', inicio: fonte.length, fim: fonte.length });
  return tokens;
}
