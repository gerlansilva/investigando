import { produce } from 'immer';
import type { Projeto } from '../modelo/tipos';
import type { Comando } from './comandos';

export const LIMITE_HISTORICO = 200;

export interface Historico {
  desfazer: readonly Comando[];
  refazer: readonly Comando[];
  selado: boolean;
}

export interface ResultadoHistorico {
  projeto: Projeto;
  historico: Historico;
}

export function criarHistorico(): Historico {
  return { desfazer: [], refazer: [], selado: true };
}

function aplicarComando(projeto: Projeto, comando: Comando): Projeto {
  return produce(projeto, (rascunho) => {
    comando.aplicar(rascunho as Projeto);
  });
}

function reverterComando(projeto: Projeto, comando: Comando): Projeto {
  return produce(projeto, (rascunho) => {
    comando.reverter(rascunho as Projeto);
  });
}

export function executar(historico: Historico, projeto: Projeto, comando: Comando): ResultadoHistorico {
  const topo = historico.desfazer[historico.desfazer.length - 1];
  const fundido = !historico.selado && topo?.fundirCom ? topo.fundirCom(comando) : null;

  if (topo && fundido) {
    const antes = reverterComando(projeto, topo);
    return {
      projeto: aplicarComando(antes, fundido),
      historico: { desfazer: [...historico.desfazer.slice(0, -1), fundido], refazer: [], selado: false },
    };
  }

  const novo = aplicarComando(projeto, comando);
  const pilha = [...historico.desfazer, comando];
  return {
    projeto: novo,
    historico: { desfazer: pilha.length > LIMITE_HISTORICO ? pilha.slice(1) : pilha, refazer: [], selado: false },
  };
}

export function desfazer(historico: Historico, projeto: Projeto): ResultadoHistorico | null {
  const comando = historico.desfazer[historico.desfazer.length - 1];
  if (!comando) return null;
  return {
    projeto: reverterComando(projeto, comando),
    historico: { desfazer: historico.desfazer.slice(0, -1), refazer: [...historico.refazer, comando], selado: true },
  };
}

export function refazer(historico: Historico, projeto: Projeto): ResultadoHistorico | null {
  const comando = historico.refazer[historico.refazer.length - 1];
  if (!comando) return null;
  return {
    projeto: aplicarComando(projeto, comando),
    historico: { desfazer: [...historico.desfazer, comando], refazer: historico.refazer.slice(0, -1), selado: true },
  };
}

export function selar(historico: Historico): Historico {
  return historico.selado ? historico : { ...historico, selado: true };
}

export function rotuloDesfazer(historico: Historico): string | null {
  const c = historico.desfazer[historico.desfazer.length - 1];
  return c ? `Desfazer: ${c.rotulo}` : null;
}

export function rotuloRefazer(historico: Historico): string | null {
  const c = historico.refazer[historico.refazer.length - 1];
  return c ? `Refazer: ${c.rotulo}` : null;
}
