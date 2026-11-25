import { mudarEstadoObjeto } from '../../estado/comandos';
import type { PropsObjeto } from '../../app/tiposObjeto';
import { t } from '../../i18n/pt-BR';
import './Texto.css';

export interface EstadoTexto {
  texto?: string;
}

export function Texto({ objeto, executar, selarHistorico }: PropsObjeto<EstadoTexto>) {
  const estado = (objeto.estado ?? {}) as EstadoTexto;
  return (
    <textarea
      className="texto-editor"
      aria-label={t.texto.area}
      placeholder={t.texto.placeholder}
      value={estado.texto ?? ''}
      onChange={(e) => executar(mudarEstadoObjeto(objeto.id, { ...estado, texto: e.target.value }, 'Editar texto'))}
      onBlur={selarHistorico}
    />
  );
}
