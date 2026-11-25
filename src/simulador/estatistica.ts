// "Coletar estatística": uma fórmula avaliada sobre os resultados de cada repetição,
// acumulando uma linha por repetição.
import { avaliarArvore } from '../formulas/avaliador';
import { compilar, type No } from '../formulas/parser';
import { paraBooleano, paraValorDeCaso } from '../formulas/valores';
import type { Caso, Colecao, ValorCelula } from '../modelo/tipos';
import type { Sorteio01 } from './dispositivos';
import { ErroSimulador } from './erro';
import { atributosDasColunas, criarExecutor } from './executor';
import {
  LIMITE_REPETICOES, LIMITE_SEGURANCA,
  type ConfigEstatistica, type ConfigSimulacao, type LinhaEstatistica, type MotivoParada, type Repeticao, type ResultadoEstatistica,
} from './tipos';

export const ID_ATRIBUTO_REPETICAO = 'est-repeticao';
export const ID_ATRIBUTO_ESTATISTICA = 'est-valor';
export const NOME_REPETICAO = 'Repetição';

/** Fórmula "quantos itens da repetição são iguais a `valor`", usada pelos anos iniciais. */
export function formulaDeContagem(nomeDaColuna: string, valor: string): string {
  let aspas = '"';
  let texto = valor;
  if (valor.includes('"')) {
    if (!valor.includes("'")) aspas = "'";
    else texto = valor.replace(/"/g, '');
  }
  return `contagem(se([${nomeDaColuna}] = ${aspas}${texto}${aspas}, 1))`;
}

function compilarOuFalhar(formula: string, oque: string): No {
  if (formula.trim() === '') throw new ErroSimulador(`Escreva ${oque}.`);
  const r = compilar(formula);
  if (!r.ok) throw new ErroSimulador(`Problema na fórmula "${formula}": ${r.erro.mensagem}.`);
  return r.arvore;
}

export function validarLimite(limite: number): void {
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_SEGURANCA) {
    throw new ErroSimulador(`O limite de repetições precisa ser um número inteiro de 1 a ${LIMITE_SEGURANCA.toLocaleString('pt-BR')}.`);
  }
}

function colecaoDaRepeticao(config: ConfigSimulacao, repeticao: Repeticao): Colecao {
  const atributos = atributosDasColunas(config).map((a) => ({ ...a }));
  const casos: Caso[] = repeticao.linhas.map((valores, i) => ({ id: `r${repeticao.numero}-${i + 1}`, valores }));
  return { id: 'repeticao', nome: 'Repetição', atributos, casos };
}

export interface ColetorEstatistica {
  /** Roda a próxima repetição e avalia a estatística. `parar` diz se 'rodar até que' terminou. */
  proxima(): { linha: LinhaEstatistica; repeticao: Repeticao; parar: MotivoParada | null };
  readonly linhas: readonly LinhaEstatistica[];
}

export function criarColetor(config: ConfigSimulacao, est: ConfigEstatistica, rng: Sorteio01, limiteTotal?: number): ColetorEstatistica {
  const rotulo = est.rotulo.trim() === '' ? 'Estatística' : est.rotulo.trim();
  if (rotulo.toLowerCase() === NOME_REPETICAO.toLowerCase()) {
    throw new ErroSimulador(`O rótulo da estatística não pode ser '${NOME_REPETICAO}'. Escolha outro nome.`);
  }
  const arvore = compilarOuFalhar(est.formula, 'a fórmula da estatística, por exemplo contagem(se([Resultado] = "Cara", 1))');
  const temCondicao = est.rodarAteQue !== undefined && est.rodarAteQue.trim() !== '';
  const condicao = temCondicao ? compilarOuFalhar(est.rodarAteQue!, 'a condição de parada') : null;
  const limite = est.limite ?? LIMITE_SEGURANCA;
  validarLimite(limite);
  const teto = limiteTotal ?? limite;

  const executor = criarExecutor(config, rng);
  const linhas: LinhaEstatistica[] = [];
  const acumulada: Colecao = {
    id: 'estatisticas', nome: 'Estatísticas',
    atributos: [
      { id: ID_ATRIBUTO_REPETICAO, nome: NOME_REPETICAO, tipo: 'numerico', cor: '' },
      { id: ID_ATRIBUTO_ESTATISTICA, nome: rotulo, tipo: 'numerico', cor: '' },
    ],
    casos: [],
  };

  return {
    linhas,
    proxima() {
      const repeticao = executor.proxima();
      const colecao = colecaoDaRepeticao(config, repeticao);
      const r = avaliarArvore(arvore, { caso: colecao.casos[0]!, colecao, globais: {}, rng, indice: 1 });
      if (!r.ok) throw new ErroSimulador(`Problema na fórmula "${est.formula}": ${r.erro.mensagem}.`);
      const valor: ValorCelula = paraValorDeCaso(r.valor);
      const linha: LinhaEstatistica = { repeticao: repeticao.numero, valor };
      linhas.push(linha);

      let parar: MotivoParada | null = null;
      if (condicao) {
        const caso: Caso = { id: `e${repeticao.numero}`, valores: { [ID_ATRIBUTO_REPETICAO]: repeticao.numero, [ID_ATRIBUTO_ESTATISTICA]: valor } };
        acumulada.casos.push(caso);
        const c = avaliarArvore(condicao, { caso, colecao: acumulada, globais: {}, rng, indice: acumulada.casos.length });
        if (!c.ok) throw new ErroSimulador(`Problema na condição "${est.rodarAteQue}": ${c.erro.mensagem}.`);
        if (paraBooleano(c.valor)) parar = 'condicao';
      }
      if (parar === null && repeticao.numero >= teto) parar = temCondicao ? 'limite' : 'completo';
      return { linha, repeticao, parar };
    },
  };
}

export function tipoDasLinhas(linhas: readonly LinhaEstatistica[]): 'numerico' | 'categorico' {
  return linhas.every((l) => l.valor === null || typeof l.valor === 'number') ? 'numerico' : 'categorico';
}

/**
 * Roda `n` repetições (ou, com `rodarAteQue`, até a condição ficar verdadeira ou até o limite de segurança)
 * e devolve uma linha de estatística por repetição.
 */
export function coletarEstatistica(config: ConfigSimulacao, est: ConfigEstatistica, n: number, rng: Sorteio01): ResultadoEstatistica {
  const temCondicao = est.rodarAteQue !== undefined && est.rodarAteQue.trim() !== '';
  if (!temCondicao && (!Number.isInteger(n) || n < 1 || n > LIMITE_REPETICOES)) {
    throw new ErroSimulador(`O número de repetições precisa ser um número inteiro de 1 a ${LIMITE_REPETICOES.toLocaleString('pt-BR')}.`);
  }
  const coletor = criarColetor(config, est, rng, temCondicao ? undefined : n);
  let motivo: MotivoParada;
  for (;;) {
    const { parar } = coletor.proxima();
    if (parar !== null) {
      motivo = parar;
      break;
    }
  }
  return { linhas: [...coletor.linhas], motivo, tipo: tipoDasLinhas(coletor.linhas) };
}
