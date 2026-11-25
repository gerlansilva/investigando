import { ErroFormula } from './erro';
import { tokenizar, type Token } from './lexer';
import type { ErroFormula as ErroFormulaTipo } from './erro';

interface Posicao {
  inicio: number;
  fim: number;
}

export type No = Posicao &
  (
    | { tipo: 'num'; valor: number }
    | { tipo: 'txt'; valor: string }
    | { tipo: 'bool'; valor: boolean }
    | { tipo: 'ref'; nome: string }
    | { tipo: 'chamada'; nome: string; args: No[] }
    | { tipo: 'bin'; op: string; esq: No; dir: No }
    | { tipo: 'un'; op: string; operando: No }
  );

const INFIXOS: Record<string, { lbp: number; direita?: boolean }> = {
  ou: { lbp: 10 },
  e: { lbp: 20 },
  '=': { lbp: 40 }, '<>': { lbp: 40 }, '<': { lbp: 40 }, '>': { lbp: 40 }, '<=': { lbp: 40 }, '>=': { lbp: 40 },
  '&': { lbp: 50 },
  '+': { lbp: 60 }, '-': { lbp: 60 },
  '*': { lbp: 70 }, '/': { lbp: 70 },
  '^': { lbp: 90, direita: true },
};
const BP_NAO = 30;
const BP_UNARIO = 80;

class Analisador {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private get atual(): Token {
    return this.tokens[this.pos]!;
  }

  private avancar(): Token {
    return this.tokens[this.pos++]!;
  }

  analisar(): No {
    if (this.atual.tipo === 'fim') throw new ErroFormula('A fórmula está vazia', 0, 0);
    const no = this.expressao(0);
    const sobra = this.atual;
    if (sobra.tipo !== 'fim') {
      if (sobra.tipo === 'fecha') throw new ErroFormula("Sobrou um parêntese ')' sem o que abre", sobra.inicio, sobra.fim);
      if (sobra.tipo === 'sep') throw new ErroFormula(`Sobrou '${sobra.texto}' fora de uma função`, sobra.inicio, sobra.fim);
      throw new ErroFormula(`Não entendi '${sobra.texto}' aqui. Faltou um operador, como + ou ×, antes?`, sobra.inicio, sobra.fim);
    }
    return no;
  }

  private expressao(bpMinimo: number): No {
    let esq = this.prefixo();
    for (;;) {
      const tok = this.atual;
      if (tok.tipo !== 'op') break;
      const info = INFIXOS[tok.valor as string];
      if (!info || info.lbp <= bpMinimo) break;
      this.avancar();
      const dir = this.expressao(info.direita ? info.lbp - 1 : info.lbp);
      esq = { tipo: 'bin', op: tok.valor as string, esq, dir, inicio: esq.inicio, fim: dir.fim };
    }
    return esq;
  }

  private prefixo(): No {
    const tok = this.avancar();
    switch (tok.tipo) {
      case 'num':
        return { tipo: 'num', valor: tok.valor as number, inicio: tok.inicio, fim: tok.fim };
      case 'txt':
        return { tipo: 'txt', valor: tok.valor as string, inicio: tok.inicio, fim: tok.fim };
      case 'bool':
        return { tipo: 'bool', valor: tok.valor as boolean, inicio: tok.inicio, fim: tok.fim };
      case 'ref':
        return { tipo: 'ref', nome: tok.valor as string, inicio: tok.inicio, fim: tok.fim };
      case 'id':
        return this.atual.tipo === 'abre' ? this.chamada(tok) : { tipo: 'ref', nome: tok.texto, inicio: tok.inicio, fim: tok.fim };
      case 'abre': {
        const dentro = this.expressao(0);
        const fecha = this.atual;
        if (fecha.tipo !== 'fecha') throw new ErroFormula('Faltou fechar o parêntese', tok.inicio, tok.fim);
        this.avancar();
        return { ...dentro, inicio: tok.inicio, fim: fecha.fim };
      }
      case 'op': {
        const op = tok.valor as string;
        if (op === '-' || op === '+') {
          const operando = this.expressao(BP_UNARIO);
          return { tipo: 'un', op, operando, inicio: tok.inicio, fim: operando.fim };
        }
        if (op === 'nao') {
          const operando = this.expressao(BP_NAO);
          return { tipo: 'un', op, operando, inicio: tok.inicio, fim: operando.fim };
        }
        throw new ErroFormula(`Faltou um valor antes de '${tok.texto}'`, tok.inicio, tok.fim);
      }
      case 'fim':
        throw new ErroFormula('A fórmula terminou antes da hora: faltou um valor no final', tok.inicio, tok.fim);
      default:
        throw new ErroFormula(`Não entendi '${tok.texto}' neste lugar`, tok.inicio, tok.fim);
    }
  }

  private chamada(nome: Token): No {
    const abre = this.avancar();
    const args: No[] = [];
    if (this.atual.tipo === 'fecha') {
      const fecha = this.avancar();
      return { tipo: 'chamada', nome: nome.texto, args, inicio: nome.inicio, fim: fecha.fim };
    }
    for (;;) {
      args.push(this.expressao(0));
      const tok = this.atual;
      if (tok.tipo === 'sep') {
        this.avancar();
        continue;
      }
      if (tok.tipo === 'fecha') {
        this.avancar();
        return { tipo: 'chamada', nome: nome.texto, args, inicio: nome.inicio, fim: tok.fim };
      }
      throw new ErroFormula(`Faltou fechar o parêntese da função '${nome.texto}'`, abre.inicio, abre.fim);
    }
  }
}

export function analisar(formula: string): No {
  return new Analisador(tokenizar(formula)).analisar();
}

export type ResultadoCompilacao = { ok: true; arvore: No } | { ok: false; erro: ErroFormulaTipo };

export function compilar(formula: string): ResultadoCompilacao {
  try {
    return { ok: true, arvore: analisar(formula) };
  } catch (e) {
    if (e instanceof ErroFormula) return { ok: false, erro: e };
    throw e;
  }
}

export function referenciasDe(no: No): string[] {
  switch (no.tipo) {
    case 'ref':
      return [no.nome];
    case 'chamada':
      return no.args.flatMap(referenciasDe);
    case 'bin':
      return [...referenciasDe(no.esq), ...referenciasDe(no.dir)];
    case 'un':
      return referenciasDe(no.operando);
    default:
      return [];
  }
}
