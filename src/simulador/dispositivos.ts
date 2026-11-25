// Dispositivos aleatórios: Roleta, Misturador e Contador.
import { numeroDeTexto } from '../formulas/valores';
import { ErroSimulador } from './erro';
import {
  LIMITE_BOLAS_POR_TIPO, LIMITE_ITENS_POR_REPETICAO,
  type Dispositivo, type Misturador, type Roleta, type Sorteio, type Contador,
} from './tipos';

export type Sorteio01 = () => number;

/** Número se o texto parece um número ("3", "2,5"); senão o próprio texto. */
export function valorDeNome(nome: string): number | string {
  const n = numeroDeTexto(nome);
  return n === undefined ? nome : n;
}

export function valoresDoContador(c: Contador): string[] {
  if (c.modo === 'ate') return Array.from({ length: Math.max(0, Math.floor(c.ate)) }, (_, i) => String(i + 1));
  return c.valores.map((v) => v.trim()).filter((v) => v !== '');
}

/** Nomes que o dispositivo pode produzir (útil para listas de escolha). */
export function nomesPossiveis(d: Dispositivo): string[] {
  if (d.tipo === 'roleta') return d.setores.map((s) => s.nome);
  if (d.tipo === 'misturador') return d.bolas.map((b) => b.nome);
  return valoresDoContador(d);
}

export function todosNumericos(d: Dispositivo): boolean {
  const nomes = nomesPossiveis(d);
  return nomes.length > 0 && nomes.every((n) => typeof valorDeNome(n) === 'number');
}

export function totalDeBolas(m: Misturador): number {
  return m.bolas.reduce((s, b) => s + b.quantidade, 0);
}

function validarRoleta(r: Roleta): void {
  if (r.setores.length === 0) throw new ErroSimulador('A roleta precisa ter pelo menos um setor.');
  r.setores.forEach((s, i) => {
    if (s.nome.trim() === '') throw new ErroSimulador(`Dê um nome ao setor ${i + 1} da roleta.`);
    if (typeof s.proporcao !== 'number' || !Number.isFinite(s.proporcao) || s.proporcao <= 0) {
      throw new ErroSimulador(`A proporção do setor '${s.nome}' precisa ser um número maior que zero.`);
    }
  });
}

function validarMisturador(m: Misturador, itens: number): void {
  if (m.bolas.length === 0) throw new ErroSimulador('O misturador precisa ter pelo menos uma bola.');
  m.bolas.forEach((b, i) => {
    if (b.nome.trim() === '') throw new ErroSimulador(`Dê um nome à bola ${i + 1} do misturador.`);
    if (!Number.isInteger(b.quantidade) || b.quantidade < 1) {
      throw new ErroSimulador(`A quantidade de bolas '${b.nome}' precisa ser um número inteiro maior que zero.`);
    }
    if (b.quantidade > LIMITE_BOLAS_POR_TIPO) {
      throw new ErroSimulador(`Use no máximo ${LIMITE_BOLAS_POR_TIPO.toLocaleString('pt-BR')} bolas '${b.nome}'.`);
    }
  });
  const total = totalDeBolas(m);
  if (!m.reposicao && itens > total) {
    throw new ErroSimulador(
      `Você pediu ${itens} itens por repetição, mas o misturador só tem ${total} ${total === 1 ? 'bola' : 'bolas'} e a reposição está desligada. Ligue a reposição ou peça no máximo ${total}.`,
    );
  }
}

function validarContador(c: Contador): void {
  if (c.modo === 'ate') {
    if (!Number.isInteger(c.ate) || c.ate < 1 || c.ate > LIMITE_ITENS_POR_REPETICAO) {
      throw new ErroSimulador(`O contador precisa ir até um número inteiro de 1 a ${LIMITE_ITENS_POR_REPETICAO.toLocaleString('pt-BR')}.`);
    }
  } else if (valoresDoContador(c).length === 0) {
    throw new ErroSimulador('Escreva pelo menos um valor para o contador.');
  }
}

export function validarDispositivo(d: Dispositivo, itensPorRepeticao: number): void {
  if (!Number.isInteger(itensPorRepeticao) || itensPorRepeticao < 1 || itensPorRepeticao > LIMITE_ITENS_POR_REPETICAO) {
    throw new ErroSimulador(`Os itens por repetição precisam ser um número inteiro de 1 a ${LIMITE_ITENS_POR_REPETICAO.toLocaleString('pt-BR')}.`);
  }
  if (d.tipo === 'roleta') validarRoleta(d);
  else if (d.tipo === 'misturador') validarMisturador(d, itensPorRepeticao);
  else validarContador(d);
}

export interface Sorteador {
  /** Chamado no começo de cada repetição. */
  iniciarRepeticao(): void;
  sortear(): Sorteio;
}

/** Índice do primeiro intervalo cuja soma cumulativa passa de `ponto` (0 <= ponto < total). */
export function indicePorSomaCumulativa(pesos: readonly number[], ponto: number): number {
  let acumulado = 0;
  for (let i = 0; i < pesos.length; i++) {
    acumulado += pesos[i]!;
    if (ponto < acumulado) return i;
  }
  // Só chega aqui por arredondamento: devolve o último com peso positivo.
  for (let i = pesos.length - 1; i >= 0; i--) if (pesos[i]! > 0) return i;
  return pesos.length - 1;
}

function sorteioDe(indice: number, nome: string, cor?: string): Sorteio {
  const s: Sorteio = { indice, nome, valor: valorDeNome(nome) };
  if (cor !== undefined) s.cor = cor;
  return s;
}

function criarSorteadorRoleta(r: Roleta, rng: Sorteio01): Sorteador {
  const pesos = r.setores.map((s) => s.proporcao);
  const total = pesos.reduce((a, b) => a + b, 0);
  return {
    iniciarRepeticao() {},
    sortear() {
      const i = indicePorSomaCumulativa(pesos, rng() * total);
      const s = r.setores[i]!;
      return sorteioDe(i, s.nome, s.cor);
    },
  };
}

function criarSorteadorMisturador(m: Misturador, rng: Sorteio01): Sorteador {
  const inicial = m.bolas.map((b) => b.quantidade);
  let restantes = [...inicial];
  let total = inicial.reduce((a, b) => a + b, 0);
  const repor = () => {
    restantes = [...inicial];
    total = inicial.reduce((a, b) => a + b, 0);
  };
  return {
    iniciarRepeticao() {
      if (!m.reposicao && m.reporEntreRepeticoes) repor();
    },
    sortear() {
      if (total <= 0) {
        throw new ErroSimulador('Acabaram as bolas do misturador. Ligue a reposição ou a opção de repor as bolas a cada repetição.');
      }
      const i = indicePorSomaCumulativa(restantes, rng() * total);
      if (!m.reposicao) {
        restantes[i] = restantes[i]! - 1;
        total -= 1;
      }
      const b = m.bolas[i]!;
      return sorteioDe(i, b.nome, b.cor);
    },
  };
}

/** O contador não usa aleatoriedade: segue a sequência e volta ao começo quando ela termina. */
function criarSorteadorContador(c: Contador): Sorteador {
  const valores = valoresDoContador(c);
  let posicao = 0;
  return {
    iniciarRepeticao() {},
    sortear() {
      const i = posicao % valores.length;
      posicao += 1;
      return sorteioDe(i, valores[i]!);
    },
  };
}

export function criarSorteador(d: Dispositivo, rng: Sorteio01): Sorteador {
  if (d.tipo === 'roleta') return criarSorteadorRoleta(d, rng);
  if (d.tipo === 'misturador') return criarSorteadorMisturador(d, rng);
  return criarSorteadorContador(d);
}
