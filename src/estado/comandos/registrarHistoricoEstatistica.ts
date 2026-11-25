import { validarRegistroEstatistica } from '../../simulador/historico';
import { criarComando, ErroComando, type Comando } from './base';
import { ErroSimulador } from '../../simulador/erro';

/** Guarda no projeto o registro de uma estatística coletada (`historicoEstatisticas`). */
export function registrarHistoricoEstatistica(registro: unknown): Comando {
  let valido;
  try {
    valido = validarRegistroEstatistica(registro);
  } catch (e) {
    if (e instanceof ErroSimulador) throw new ErroComando(e.message);
    throw e;
  }
  return criarComando({
    rotulo: `Registrar estatística '${valido.rotulo}'`,
    receita: (p) => {
      p.historicoEstatisticas.push(structuredClone(valido));
    },
  });
}
