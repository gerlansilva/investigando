import type { Comando } from '../../estado/comandos';
import type { EtapaCiclo, Id, ObjetoMesa, Projeto, TipoObjeto } from '../../modelo/tipos';

/** Objetos que cada etapa convida a criar quando está vazia. */
const sugeridos: Record<EtapaCiclo, TipoObjeto[]> = {
  problema: ['texto'],
  plano: ['tabela'],
  dados: ['tabela', 'fichas'],
  analise: ['grafico'],
  conclusao: ['texto'],
};

export function sugeridosDa(etapa: EtapaCiclo): readonly TipoObjeto[] {
  return sugeridos[etapa];
}

/** Ponto de extensão: acrescenta um tipo (por exemplo, 'simulador' no Plano) aos convites de uma etapa. */
export function registrarSugerido(etapa: EtapaCiclo, tipo: TipoObjeto): void {
  if (!sugeridos[etapa].includes(tipo)) sugeridos[etapa] = [...sugeridos[etapa], tipo];
}

export function removerSugerido(etapa: EtapaCiclo, tipo: TipoObjeto): void {
  sugeridos[etapa] = sugeridos[etapa].filter((x) => x !== tipo);
}

export interface ContextoCriacao {
  projeto: Projeto;
  etapa: EtapaCiclo;
  posicao: { x: number; y: number };
  /** Coleção do objeto focado (ou a primeira do projeto), se houver. */
  colecaoId: Id | undefined;
}

export interface ResultadoCriacao {
  comando: Comando;
  objeto: ObjetoMesa;
}

/** Cria um objeto de um tipo que a Mesa não sabe montar sozinha (ex.: simulador). Devolve null para recusar. */
export type CriadorObjeto = (contexto: ContextoCriacao) => ResultadoCriacao | null;

const criadores = new Map<TipoObjeto, CriadorObjeto>();

/** Ponto de extensão: o Simulador registra aqui como criar o objeto; o tipo passa a aparecer na barra Novo. */
export function registrarCriadorDeObjeto(tipo: TipoObjeto, criador: CriadorObjeto): void {
  criadores.set(tipo, criador);
}

export function removerCriadorDeObjeto(tipo: TipoObjeto): void {
  criadores.delete(tipo);
}

export function criadorDe(tipo: TipoObjeto): CriadorObjeto | undefined {
  return criadores.get(tipo);
}

export function tiposComCriador(): TipoObjeto[] {
  return [...criadores.keys()];
}
