import type { Colecao, Id, ObjetoMesa } from '../modelo/tipos';
import type { Comando } from '../estado/comandos';

export type ModoSelecaoObjeto = 'substituir' | 'alternar' | 'limpar';
export type PerfilEnsino = 'iniciais' | 'finais';

/** Propriedades que todo componente de objeto da mesa recebe (ver docs/CONTRATO-UI.md). */
export interface PropsObjeto<E = unknown> {
  /** Objeto da mesa; `objeto.estado` é do tipo E. */
  objeto: Omit<ObjetoMesa, 'estado'> & { estado: E };
  /** Coleção ligada via `objeto.estado.colecaoId`. */
  colecao: Colecao | undefined;
  /** Casos selecionados dessa coleção. */
  selecao: ReadonlySet<Id>;
  aoSelecionar(ids: Id[], modo: ModoSelecaoObjeto): void;
  /** Executa um comando no histórico (ver src/estado/comandos). */
  executar(comando: Comando): void;
  /** Chamar ao soltar o mouse / terminar uma edição contínua. */
  selarHistorico(): void;
  /** Anos iniciais escondem ferramentas avançadas. */
  perfil: PerfilEnsino;
}
