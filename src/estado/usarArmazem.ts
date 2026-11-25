import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { Id, Projeto } from '../modelo/tipos';
import { rotuloDesfazer, rotuloRefazer } from './historico';
import type { EstadoApp } from './store';

export type Armazem = StoreApi<EstadoApp>;

const ContextoArmazem = createContext<Armazem | null>(null);

export interface PropsProvedor {
  armazem: Armazem;
  children?: ReactNode;
}

export function ProvedorArmazem({ armazem, children }: PropsProvedor) {
  return createElement(ContextoArmazem.Provider, { value: armazem }, children);
}

/** Armazém do contexto; erro claro se faltar o provedor. */
export function useArmazem(): Armazem {
  const armazem = useContext(ContextoArmazem);
  if (!armazem) throw new Error('useArmazem precisa estar dentro de <ProvedorArmazem>.');
  return armazem;
}

/** Armazém do contexto ou null (para componentes que funcionam sem provedor). */
export function useArmazemOpcional(): Armazem | null {
  return useContext(ContextoArmazem);
}

export function useEstado<T>(seletor: (estado: EstadoApp) => T): T {
  return useStore(useArmazem(), seletor);
}

export function useProjeto(): Projeto {
  return useEstado((s) => s.projeto);
}

export function useSelecaoCasos(): Record<Id, Set<Id>> {
  return useEstado((s) => s.selecaoCasos);
}

export function useObjetoFocado(): Id | null {
  return useEstado((s) => s.objetoFocado);
}

/** Rótulos legíveis do histórico ("Desfazer: Mover objeto"), ou null quando a pilha está vazia. */
export function useRotulosHistorico(): { desfazer: string | null; refazer: string | null } {
  const historico = useEstado((s) => s.historico);
  return useMemo(() => ({ desfazer: rotuloDesfazer(historico), refazer: rotuloRefazer(historico) }), [historico]);
}

/** Ações estáveis do armazém (as funções do store não mudam entre renderizações). */
export function useAcoes() {
  const armazem = useArmazem();
  return useMemo(() => {
    const s = armazem.getState();
    return {
      executar: s.executar,
      desfazer: s.desfazer,
      refazer: s.refazer,
      selarHistorico: s.selarHistorico,
      abrir: s.abrir,
      selecionarCasos: s.selecionarCasos,
      limparSelecao: s.limparSelecao,
      focarObjeto: s.focarObjeto,
      serializar: s.serializar,
    };
  }, [armazem]);
}
