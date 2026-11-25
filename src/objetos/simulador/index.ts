import { registrarTipoObjeto } from '../../app/registro';
import { Simulador } from './Simulador';

export { Simulador } from './Simulador';

/** Liga o componente ao tipo 'simulador' da mesa (chamar uma vez ao iniciar o app). */
export function registrarSimulador(): void {
  registrarTipoObjeto('simulador', Simulador);
}
