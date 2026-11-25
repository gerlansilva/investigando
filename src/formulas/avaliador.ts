import type { Atributo, Colecao } from '../modelo/tipos';
import { ErroFormula } from './erro';
import { buscarFuncao } from './funcoes';
import type { ContextoFuncao, DefinicaoFuncao } from './funcoes';
import { compilar, type No } from './parser';
import type { Contexto, Resultado, Valor } from './tipos';
import { ErroDeFuncao, normalizarNome, paraBooleano, paraNumero, paraTexto, tentarNumero } from './valores';

export function acharAtributo(colecao: Colecao, nome: string): Atributo | undefined {
  const exato = colecao.atributos.find((a) => a.nome === nome);
  if (exato) return exato;
  const alvo = normalizarNome(nome);
  return colecao.atributos.find((a) => normalizarNome(a.nome) === alvo);
}

function acharGlobal(globais: Record<string, number>, nome: string): number | undefined {
  if (nome in globais) return globais[nome];
  const alvo = normalizarNome(nome);
  const chave = Object.keys(globais).find((k) => normalizarNome(k) === alvo);
  return chave === undefined ? undefined : globais[chave];
}

function resolverReferencia(no: Extract<No, { tipo: 'ref' }>, ctx: Contexto): Valor {
  const atributo = acharAtributo(ctx.colecao, no.nome);
  if (atributo) return ctx.caso.valores[atributo.id] ?? null;
  const global = acharGlobal(ctx.globais, no.nome);
  if (global !== undefined) return global;
  throw new ErroFormula(`Não achei o atributo '${no.nome}'`, no.inicio, no.fim);
}

function comparar(op: string, esq: Valor, dir: Valor): Valor {
  if (esq === null || dir === null) return null;
  const a = tentarNumero(esq);
  const b = tentarNumero(dir);
  let ordem: number;
  if (a !== undefined && b !== undefined) ordem = a - b;
  else ordem = paraTexto(esq).localeCompare(paraTexto(dir), 'pt-BR', { sensitivity: 'base' });
  switch (op) {
    case '=': return ordem === 0;
    case '<>': return ordem !== 0;
    case '<': return ordem < 0;
    case '>': return ordem > 0;
    case '<=': return ordem <= 0;
    default: return ordem >= 0;
  }
}

function checarResultado(x: number, no: No): number {
  if (Number.isNaN(x)) throw new ErroFormula('Esse cálculo não tem resultado (talvez seja raiz de número negativo)', no.inicio, no.fim);
  if (!Number.isFinite(x)) throw new ErroFormula('O resultado ficou grande demais', no.inicio, no.fim);
  return x;
}

function aritmetica(no: Extract<No, { tipo: 'bin' }>, esq: Valor, dir: Valor): Valor {
  const a = paraNumero(esq);
  const b = paraNumero(dir);
  if (a === null || b === null) return null;
  switch (no.op) {
    case '+': return checarResultado(a + b, no);
    case '-': return checarResultado(a - b, no);
    case '*': return checarResultado(a * b, no);
    case '/':
      if (b === 0) throw new ErroFormula('Não dá para dividir por zero', no.dir.inicio, no.dir.fim);
      return checarResultado(a / b, no);
    default: return checarResultado(a ** b, no);
  }
}

function contextoDeFuncao(ctx: Contexto): ContextoFuncao {
  return {
    ...ctx,
    rng: ctx.rng ?? Math.random,
    indice: ctx.indice ?? ctx.colecao.casos.findIndex((c) => c.id === ctx.caso.id) + 1,
  };
}

function descreverAridade(def: DefinicaoFuncao): string {
  const plural = (n: number) => `${n} ${n === 1 ? 'argumento' : 'argumentos'}`;
  if (def.max === 0) return 'não recebe argumentos';
  if (def.min === def.max) return `precisa de ${plural(def.min)}`;
  if (def.max === Infinity) return `precisa de pelo menos ${plural(def.min)}`;
  return `aceita de ${def.min} a ${plural(def.max)}`;
}

function valoresParaAgregar(no: Extract<No, { tipo: 'chamada' }>, ctx: Contexto): Valor[] {
  const { casos } = ctx.colecao;
  if (no.args.length === 0) return casos.map(() => 1);
  if (no.args.length > 1) return no.args.map((a) => avaliarNo(a, ctx));
  const [unico] = no.args;
  if (unico!.tipo === 'ref') {
    const atributo = acharAtributo(ctx.colecao, unico!.nome);
    if (atributo) return casos.map((c) => c.valores[atributo.id] ?? null);
  }
  return casos.map((caso, i) => avaliarNo(unico!, { ...ctx, caso, indice: i + 1 }));
}

function avaliarChamada(no: Extract<No, { tipo: 'chamada' }>, ctx: Contexto): Valor {
  const def = buscarFuncao(no.nome);
  if (!def) throw new ErroFormula(`Não conheço a função '${no.nome}'`, no.inicio, no.fim);
  if (no.args.length < def.min || no.args.length > def.max) {
    throw new ErroFormula(`A função '${def.nome}' ${descreverAridade(def)}`, no.inicio, no.fim);
  }
  try {
    if (def.especial) return def.especial(no.args, ctx, avaliarNo);
    const args = def.agregacao ? valoresParaAgregar(no, ctx) : no.args.map((a) => avaliarNo(a, ctx));
    return def.executar!(args, contextoDeFuncao(ctx));
  } catch (e) {
    if (e instanceof ErroDeFuncao) throw new ErroFormula(e.message, no.inicio, no.fim);
    throw e;
  }
}

export function avaliarNo(no: No, ctx: Contexto): Valor {
  switch (no.tipo) {
    case 'num':
    case 'txt':
    case 'bool':
      return no.valor;
    case 'ref':
      return resolverReferencia(no, ctx);
    case 'chamada':
      return avaliarChamada(no, ctx);
    case 'un': {
      const v = avaliarNo(no.operando, ctx);
      try {
        if (no.op === 'nao') return !paraBooleano(v);
        const n = paraNumero(v);
        return n === null ? null : no.op === '-' ? -n : n;
      } catch (e) {
        if (e instanceof ErroDeFuncao) throw new ErroFormula(e.message, no.operando.inicio, no.operando.fim);
        throw e;
      }
    }
    case 'bin': {
      if (no.op === 'e') return paraBooleano(avaliarNo(no.esq, ctx)) && paraBooleano(avaliarNo(no.dir, ctx));
      if (no.op === 'ou') return paraBooleano(avaliarNo(no.esq, ctx)) || paraBooleano(avaliarNo(no.dir, ctx));
      const esq = avaliarNo(no.esq, ctx);
      const dir = avaliarNo(no.dir, ctx);
      if (no.op === '&') return paraTexto(esq) + paraTexto(dir);
      if (['=', '<>', '<', '>', '<=', '>='].includes(no.op)) return comparar(no.op, esq, dir);
      try {
        return aritmetica(no, esq, dir);
      } catch (e) {
        if (e instanceof ErroDeFuncao) {
          const culpado = typeof esq === 'string' && tentarNumero(esq) === undefined ? no.esq : no.dir;
          throw new ErroFormula(e.message, culpado.inicio, culpado.fim);
        }
        throw e;
      }
    }
  }
}

export function avaliarFormula(formula: string, ctx: Contexto): Resultado {
  const compilada = compilar(formula);
  if (!compilada.ok) return compilada;
  return avaliarArvore(compilada.arvore, ctx);
}

export function avaliarArvore(arvore: No, ctx: Contexto): Resultado {
  try {
    return { ok: true, valor: avaliarNo(arvore, ctx) };
  } catch (e) {
    if (e instanceof ErroFormula) return { ok: false, erro: e };
    throw e;
  }
}
