import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Lugares da barra superior onde a Mesa, o Ciclo e os objetos encaixam suas ferramentas. */
export interface EncaixesBarra {
  /** Desfazer, Refazer e a criação de objetos novos. */
  mesa: HTMLElement | null;
  /** Ferramentas do objeto focado. */
  contextual: HTMLElement | null;
  /** Trilho lateral: criação de objetos novos (opcional; sem ele, vão junto de `mesa`). */
  novo?: HTMLElement | null;
  /** Opções de visão (Organizar, Mesa livre) antes do seletor de perfil. */
  visao: HTMLElement | null;
}

export const ContextoBarra = createContext<EncaixesBarra | null>(null);

/** Leva o conteúdo para um encaixe da barra; sem encaixe (testes isolados), devolve `senao`. */
export function Encaixar({ encaixe, children, senao = null }: { encaixe: HTMLElement | null | undefined; children: ReactNode; senao?: ReactNode }) {
  return encaixe ? createPortal(children, encaixe) : <>{senao}</>;
}

export interface ContextoDoObjeto {
  focado: boolean;
  /** Encaixe da barra contextual onde as ferramentas do objeto aparecem quando ele está focado. */
  encaixe: HTMLElement | null;
}

/** Fornecido pela Mesa para cada objeto; ausente quando o objeto é usado sozinho (por exemplo, em testes). */
export const ContextoObjeto = createContext<ContextoDoObjeto | null>(null);

export function useObjetoNaMesa(): ContextoDoObjeto | null {
  return useContext(ContextoObjeto);
}

/**
 * Ferramentas de um objeto. Na Mesa, aparecem na barra do topo enquanto o objeto está focado;
 * fora da Mesa, ficam numa faixa dentro do próprio objeto.
 */
export function Ferramentas({ rotulo, children, complementar = false }: { rotulo: string; children: ReactNode; complementar?: boolean }) {
  const contexto = useContext(ContextoObjeto);
  if (!contexto) {
    return complementar
      ? <aside className="ferramentas-local" aria-label={rotulo}>{children}</aside>
      : <div className="ferramentas-local" role="toolbar" aria-label={rotulo}>{children}</div>;
  }
  if (!contexto.focado || !contexto.encaixe) return null;
  return createPortal(<div className="ferramentas" role="toolbar" aria-label={rotulo}>{children}</div>, contexto.encaixe);
}
