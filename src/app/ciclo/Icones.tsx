import type { EtapaCiclo } from '../../modelo/tipos';

/** Ícones simples (decorativos; o botão que os contém tem o nome acessível). */
export function IconeEtapa({ etapa }: { etapa: EtapaCiclo }) {
  const comum = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false };
  switch (etapa) {
    case 'problema':
      return (
        <svg {...comum}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></svg>
      );
    case 'plano':
      return (
        <svg {...comum}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9z" /><path d="M8.5 11h7M8.5 15h7" /></svg>
      );
    case 'dados':
      return (
        <svg {...comum}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M4 14.5h16M10 5v14" /></svg>
      );
    case 'analise':
      return (
        <svg {...comum}><path d="M4 20h16" /><rect x="6" y="12" width="3" height="8" /><rect x="11" y="7" width="3" height="13" /><rect x="16" y="14" width="3" height="6" /></svg>
      );
    case 'conclusao':
      return (
        <svg {...comum}><path d="M6 21V4" /><path d="M6 5h11l-2 3.5 2 3.5H6" /></svg>
      );
  }
}

export function IconeConcluida() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  );
}
