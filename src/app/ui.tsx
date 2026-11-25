import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Icone, type NomeIcone } from './icones';

export interface PropsFerramenta extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icone: NomeIcone;
  rotulo: string;
  /** Texto só para leitores de tela, junto do rótulo visível (por exemplo, o que o Desfazer vai desfazer). */
  detalhe?: string;
  /** Quando definido, a ferramenta é um interruptor (aria-pressed). */
  ativo?: boolean;
}

/** Ferramenta da barra: ícone com rótulo pequeno embaixo, sem contorno; só destaca quando ativa. */
export function Ferramenta({ icone, rotulo, detalhe, ativo, className, ...resto }: PropsFerramenta) {
  return (
    <button type="button" className={`ferramenta${className ? ` ${className}` : ''}`} aria-pressed={ativo} {...resto}>
      <Icone nome={icone} />
      <span className="ferramenta-rotulo">{rotulo}</span>
      {detalhe && <span className="so-leitor">{detalhe}</span>}
    </button>
  );
}

export function Separador() {
  return <span className="separador" role="separator" aria-orientation="vertical" />;
}

export interface ItemMenu {
  rotulo: string;
  /** Nome acessível, quando precisa ser mais completo que o texto visível. */
  aria?: string;
  aoEscolher(): void;
  perigo?: boolean;
  desligado?: boolean;
}

export interface PropsMenu {
  /** Nome acessível do botão que abre o menu. */
  rotulo: string;
  itens: readonly ItemMenu[];
  icone?: NomeIcone;
  /** Texto visível ao lado do ícone (opcional). */
  texto?: string;
  className?: string;
  alinhar?: 'inicio' | 'fim';
}

/** Menu de ações: botão com aria-haspopup, setas, Home/End, Esc fecha e devolve o foco, clique fora fecha. */
export function Menu({ rotulo, itens, icone = 'mais', texto, className, alinhar = 'fim' }: PropsMenu) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const raiz = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itensRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!aberto) return;
    const primeiro = itensRef.current.find((b) => b && !b.disabled);
    primeiro?.focus();
    function fora(e: PointerEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  function aoTeclarMenu(e: KeyboardEvent<HTMLElement>) {
    const lista = itensRef.current.filter((b): b is HTMLButtonElement => !!b && !b.disabled);
    const i = lista.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      lista[(i + 1) % lista.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      lista[(i - 1 + lista.length) % lista.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      lista[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      lista[lista.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setAberto(false);
    }
  }

  return (
    <span className={`menu${className ? ` ${className}` : ''}`} ref={raiz}>
      <button
        ref={botao}
        type="button"
        className="menu-botao"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => setAberto(!aberto)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !aberto) {
            e.preventDefault();
            setAberto(true);
          } else if (e.key === 'Escape' && aberto) {
            e.stopPropagation();
            setAberto(false);
          }
        }}
      >
        <Icone nome={icone} />
        {texto && <span>{texto}</span>}
        {texto && <Icone nome="seta" tamanho={14} />}
      </button>
      {aberto && (
        <div id={id} role="menu" aria-label={rotulo} className="menu-lista" data-alinhar={alinhar} onKeyDown={aoTeclarMenu} onPointerDown={(e) => e.stopPropagation()}>
          {itens.map((item, i) => (
            <button
              key={item.rotulo}
              ref={(el) => { itensRef.current[i] = el; }}
              type="button"
              role="menuitem"
              className={`menu-item${item.perigo ? ' perigo' : ''}`}
              aria-label={item.aria}
              disabled={item.desligado}
              onClick={() => {
                fechar(false);
                item.aoEscolher();
              }}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function GrupoNomeado({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grupo-nomeado">
      <span className="grupo-nome" aria-hidden="true">{nome}</span>
      {children}
    </div>
  );
}
