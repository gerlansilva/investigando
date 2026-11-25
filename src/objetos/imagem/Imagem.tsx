import { useRef, useState, type ChangeEvent } from 'react';
import { mudarEstadoObjeto } from '../../estado/comandos';
import type { PropsObjeto } from '../../app/tiposObjeto';
import { t } from '../../i18n/pt-BR';
import { Ferramentas } from '../../app/contextoBarra';
import { Ferramenta } from '../../app/ui';
import './Imagem.css';

export interface EstadoImagem {
  dataUrl?: string;
  nome?: string;
  ajuste?: 'conter' | 'cobrir';
}

export const LIMITE_BYTES_IMAGEM = 5 * 1024 * 1024;

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => (typeof leitor.result === 'string' ? resolve(leitor.result) : reject(new Error(t.imagem.falhaLeitura)));
    leitor.onerror = () => reject(new Error(t.imagem.falhaLeitura));
    leitor.readAsDataURL(arquivo);
  });
}

export function Imagem({ objeto, executar, selarHistorico }: PropsObjeto<EstadoImagem>) {
  const estado = (objeto.estado ?? {}) as EstadoImagem;
  const [erro, setErro] = useState<string | null>(null);
  const entradaRef = useRef<HTMLInputElement>(null);
  const ajuste = estado.ajuste ?? 'conter';

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) return setErro(t.imagem.naoEImagem);
    if (arquivo.size > LIMITE_BYTES_IMAGEM) return setErro(t.imagem.grandeDemais);
    try {
      const dataUrl = await lerComoDataUrl(arquivo);
      executar(mudarEstadoObjeto(objeto.id, { ...estado, dataUrl, nome: arquivo.name, ajuste }, 'Trocar imagem'));
      selarHistorico();
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : t.imagem.falhaLeitura);
    }
  }

  function mudarAjuste(novo: 'conter' | 'cobrir') {
    executar(mudarEstadoObjeto(objeto.id, { ...estado, ajuste: novo }, 'Ajustar imagem'));
    selarHistorico();
  }

  return (
    <div className="imagem">
      <Ferramentas rotulo={t.imagem.ferramentas}>
        <Ferramenta icone="imagem" rotulo={estado.dataUrl ? t.imagem.trocar : t.imagem.escolher} onClick={() => entradaRef.current?.click()} />
        {estado.dataUrl && (
          <div className="barra-grupo" role="group" aria-label={t.imagem.ajuste}>
            <Ferramenta icone="conter" rotulo={t.imagem.ajusteConter} ativo={ajuste === 'conter'} onClick={() => mudarAjuste('conter')} />
            <Ferramenta icone="cobrir" rotulo={t.imagem.ajusteCobrir} ativo={ajuste === 'cobrir'} onClick={() => mudarAjuste('cobrir')} />
          </div>
        )}
      </Ferramentas>
      <div className="imagem-barra">
        <input ref={entradaRef} type="file" accept="image/*" className="imagem-entrada" aria-label={t.imagem.escolher} onChange={aoEscolher} />
      </div>
      <div className="imagem-quadro">
        {estado.dataUrl ? (
          <img
            src={estado.dataUrl}
            alt={estado.nome ? t.imagem.descricao(estado.nome) : t.imagem.descricaoPadrao}
            style={{ objectFit: ajuste === 'cobrir' ? 'cover' : 'contain' }}
            draggable={false}
          />
        ) : (
          <p className="imagem-vazio">{t.imagem.semImagem}</p>
        )}
      </div>
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </div>
  );
}
