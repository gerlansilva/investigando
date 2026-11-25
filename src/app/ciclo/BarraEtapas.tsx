import { useRef, type KeyboardEvent } from 'react';
import { ETAPAS, type EtapaCiclo } from '../../modelo/tipos';
import { t } from '../../i18n/pt-BR';
import { IconeConcluida, IconeEtapa } from './Icones';

export interface PropsBarraEtapas {
  etapaAtual: EtapaCiclo;
  concluidas: readonly EtapaCiclo[];
  aoMudar(etapa: EtapaCiclo): void;
  /** Etapas que o professor travou: aparecem desabilitadas. */
  travadas?: readonly EtapaCiclo[];
}

/** As cinco etapas; navegação livre por clique, Enter/Espaço e setas. */
export function BarraEtapas({ etapaAtual, concluidas, aoMudar, travadas = [] }: PropsBarraEtapas) {
  const botoes = useRef<Partial<Record<EtapaCiclo, HTMLButtonElement | null>>>({});

  function aoTeclar(e: KeyboardEvent<HTMLElement>) {
    const i = ETAPAS.indexOf(etapaAtual);
    let alvo: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') alvo = Math.min(ETAPAS.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') alvo = Math.max(0, i - 1);
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = ETAPAS.length - 1;
    if (alvo === null) return;
    e.preventDefault();
    const etapa = ETAPAS[alvo]!;
    if (travadas.includes(etapa)) return;
    if (etapa !== etapaAtual) aoMudar(etapa);
    botoes.current[etapa]?.focus();
  }

  return (
    <nav className="etapas" aria-label={t.ciclo.barra} onKeyDown={aoTeclar}>
      <ol>
        {ETAPAS.map((etapa, i) => {
          const atual = etapa === etapaAtual;
          const concluida = concluidas.includes(etapa);
          const nome = t.ciclo.etapas[etapa];
          const travada = travadas.includes(etapa);
          return (
            <li key={etapa}>
              <button
                ref={(el) => { botoes.current[etapa] = el; }}
                type="button"
                className="etapa-botao"
                data-etapa={etapa}
                data-atual={atual}
                data-concluida={concluida}
                aria-current={atual ? 'step' : undefined}
                aria-label={t.ciclo.etapaAria(nome, i + 1, ETAPAS.length, atual, concluida)}
                disabled={travada}
                title={travada ? t.professor.etapaTravada : undefined}
                onClick={() => { if (!atual && !travada) aoMudar(etapa); }}
              >
                <span className="etapa-icone"><IconeEtapa etapa={etapa} /></span>
                <span className="etapa-nome">{nome}</span>
                {concluida && <span className="etapa-check"><IconeConcluida /></span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
