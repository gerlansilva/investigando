import { registrarTipoObjeto } from '../../app/registro';
import { Grafico } from './Grafico';

export { Grafico } from './Grafico';
export { exportarPng, prepararExportacao, baixarBlob } from './exportar';
export * from './estado';
export { prepararLayout } from './layout';

/** Liga o componente ao tipo 'grafico' da mesa (chamar uma vez ao iniciar o app). */
export function registrarGrafico(): void {
  registrarTipoObjeto('grafico', Grafico);
}
