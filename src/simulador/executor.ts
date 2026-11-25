// Executa repetições do simulador e monta as colunas de resultado.
import { numerosDe } from '../formulas/funcoes/estatistica';
import { PALETA_ATRIBUTOS } from '../modelo/fabrica';
import type { ValorCelula } from '../modelo/tipos';
import { criarSorteador, todosNumericos, validarDispositivo, type Sorteio01 } from './dispositivos';
import { ErroSimulador } from './erro';
import {
  LIMITE_REPETICOES,
  type ColunaResultado, type ConfigSimulacao, type LinhaResultado, type Repeticao, type Sorteio, type TipoColuna,
} from './tipos';

export const NOMES_DE_COLUNA: Record<TipoColuna, string> = {
  repeticao: 'Repetição', item: 'Item', valor: 'Resultado', contagem: 'Contagem', soma: 'Soma',
  media: 'Média', minimo: 'Mínimo', maximo: 'Máximo',
};

export function colunasPadrao(): ColunaResultado[] {
  return [
    { id: 'col-repeticao', nome: NOMES_DE_COLUNA.repeticao, tipo: 'repeticao' },
    { id: 'col-resultado', nome: NOMES_DE_COLUNA.valor, tipo: 'valor' },
  ];
}

export function validarColunas(colunas: readonly ColunaResultado[]): void {
  if (colunas.length === 0) throw new ErroSimulador('Escolha pelo menos uma coluna para o resultado.');
  const nomes = new Set<string>();
  const ids = new Set<string>();
  for (const c of colunas) {
    const nome = c.nome.trim();
    if (nome === '') throw new ErroSimulador('Toda coluna do resultado precisa de um nome.');
    if (nomes.has(nome.toLowerCase())) throw new ErroSimulador(`Há duas colunas chamadas '${nome}'. Use nomes diferentes.`);
    nomes.add(nome.toLowerCase());
    if (ids.has(c.id)) throw new ErroSimulador(`Há duas colunas com o mesmo identificador ('${c.id}').`);
    ids.add(c.id);
    if (c.tipo === 'contagem' && (c.elemento === undefined || c.elemento === '')) {
      throw new ErroSimulador(`Escolha qual elemento a coluna '${nome}' deve contar.`);
    }
  }
}

export function validarConfig(config: ConfigSimulacao): void {
  validarDispositivo(config.dispositivo, config.itensPorRepeticao);
  validarColunas(config.colunas);
}

function resumo(itens: Sorteio[], tipo: TipoColuna): number | null {
  const numeros = numerosDe(itens.map((i) => i.valor));
  if (numeros.length === 0) return null;
  switch (tipo) {
    case 'soma': return numeros.reduce((a, b) => a + b, 0);
    case 'media': return numeros.reduce((a, b) => a + b, 0) / numeros.length;
    case 'minimo': return Math.min(...numeros);
    default: return Math.max(...numeros);
  }
}

function valorDaColuna(c: ColunaResultado, numero: number, posicao: number, itens: Sorteio[]): ValorCelula {
  switch (c.tipo) {
    case 'repeticao': return numero;
    case 'item': return posicao + 1;
    case 'valor': return itens[posicao]!.valor;
    case 'contagem': return itens.filter((i) => i.nome === c.elemento).length;
    default: return resumo(itens, c.tipo);
  }
}

export function montarLinhas(colunas: readonly ColunaResultado[], numero: number, itens: Sorteio[]): LinhaResultado[] {
  // Colunas de resumo valem para a repetição inteira: calcula uma vez.
  const fixos = new Map<string, ValorCelula>();
  for (const c of colunas) {
    if (c.tipo === 'contagem' || c.tipo === 'soma' || c.tipo === 'media' || c.tipo === 'minimo' || c.tipo === 'maximo') {
      fixos.set(c.id, valorDaColuna(c, numero, 0, itens));
    }
  }
  return itens.map((_, posicao) => {
    const linha: LinhaResultado = {};
    for (const c of colunas) linha[c.id] = fixos.has(c.id) ? fixos.get(c.id)! : valorDaColuna(c, numero, posicao, itens);
    return linha;
  });
}

/** Atributos (nome, tipo, cor) que correspondem às colunas; `id` do atributo = `id` da coluna. */
export function atributosDasColunas(config: ConfigSimulacao): { id: string; nome: string; tipo: 'numerico' | 'categorico'; cor: string }[] {
  const numerico = todosNumericos(config.dispositivo);
  return config.colunas.map((c, i) => ({
    id: c.id,
    nome: c.nome.trim(),
    tipo: c.tipo === 'valor' && !numerico ? 'categorico' : 'numerico',
    cor: PALETA_ATRIBUTOS[i % PALETA_ATRIBUTOS.length]!,
  }));
}

export interface Executor {
  /** Gera a próxima repetição. */
  proxima(): Repeticao;
  readonly repeticoesFeitas: number;
}

/** Cria um executor com estado próprio (por exemplo, bolas já tiradas do misturador sem reposição). */
export function criarExecutor(config: ConfigSimulacao, rng: Sorteio01): Executor {
  validarConfig(config);
  const sorteador = criarSorteador(config.dispositivo, rng);
  let feitas = 0;
  return {
    get repeticoesFeitas() {
      return feitas;
    },
    proxima() {
      sorteador.iniciarRepeticao();
      const itens: Sorteio[] = [];
      for (let i = 0; i < config.itensPorRepeticao; i++) {
        try {
          itens.push(sorteador.sortear());
        } catch (e) {
          if (e instanceof ErroSimulador) throw new ErroSimulador(`Na repetição ${feitas + 1}: ${e.message}`);
          throw e;
        }
      }
      feitas += 1;
      return { numero: feitas, itens, linhas: montarLinhas(config.colunas, feitas, itens) };
    },
  };
}

/** Gera os resultados de uma repetição (itens por repetição = `config.itensPorRepeticao`). */
export function executar(config: ConfigSimulacao, rng: Sorteio01): Repeticao {
  return criarExecutor(config, rng).proxima();
}

export function executarRepeticoes(config: ConfigSimulacao, n: number, rng: Sorteio01): Repeticao[] {
  if (!Number.isInteger(n) || n < 1 || n > LIMITE_REPETICOES) {
    throw new ErroSimulador(`O número de repetições precisa ser um número inteiro de 1 a ${LIMITE_REPETICOES.toLocaleString('pt-BR')}.`);
  }
  const executor = criarExecutor(config, rng);
  const repeticoes: Repeticao[] = [];
  for (let i = 0; i < n; i++) repeticoes.push(executor.proxima());
  return repeticoes;
}
