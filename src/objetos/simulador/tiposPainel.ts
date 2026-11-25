import type { PerfilEnsino } from '../../app/tiposObjeto';
import type { EstadoSimulador } from '../../simulador';

export interface PropsPainel {
  estado: EstadoSimulador;
  /** Troca campos do estado do objeto (comando desfazível, fundido enquanto a pessoa digita). */
  mudar(parcial: Partial<EstadoSimulador>): void;
  /** Fecha uma edição contínua no histórico. */
  selar(): void;
  perfil: PerfilEnsino;
}
