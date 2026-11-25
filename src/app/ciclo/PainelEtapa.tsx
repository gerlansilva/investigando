import { useId, useRef, useState, type ReactNode } from 'react';
import {
  cicloCorrente, definirCampoConclusao, definirPergunta, desmarcarEtapaConcluida, marcarEtapaConcluida, novoCiclo,
  type CampoConclusao,
} from '../../estado/comandos';
import { useAcoes, useProjeto } from '../../estado/usarArmazem';
import { t } from '../../i18n/pt-BR';
import type { EtapaCiclo } from '../../modelo/tipos';
import { Icone } from '../icones';
import type { PerfilEnsino } from '../tiposObjeto';
import { Menu } from '../ui';
import { avisosDaPergunta } from './pergunta';

export interface PropsPainelEtapa {
  etapa: EtapaCiclo;
  perfil: PerfilEnsino;
  /** Abas das etapas (a faixa do ciclo as coloca na mesma linha da pergunta). */
  abas: ReactNode;
  /** Ações pequenas extras (Resumo, Mesa livre) antes de "Marcar etapa como concluída". */
  acoes?: ReactNode;
  /** Painéis que se abrem logo abaixo da faixa (por exemplo, o Resumo). */
  children?: ReactNode;
}

/** Faixa do ciclo: abas das etapas, pergunta e ações numa única linha fina, mais a pergunta-guia compacta. */
export function PainelEtapa({ etapa, perfil, abas, acoes, children }: PropsPainelEtapa) {
  const projeto = useProjeto();
  const { executar, selarHistorico } = useAcoes();
  const [erro, setErro] = useState<string | null>(null);
  const ajudaId = useId();
  const campoPergunta = useRef<HTMLTextAreaElement>(null);
  const ciclo = cicloCorrente(projeto);
  const concluida = ciclo?.etapasConcluidas.includes(etapa) ?? false;
  const limitesVazios = !(ciclo?.conclusao?.limites ?? '').trim();
  const bloqueada = etapa === 'conclusao' && !concluida && limitesVazios;

  function tentar(acao: () => void) {
    try {
      acao();
      selarHistorico();
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t.ciclo.erroGenerico);
    }
  }

  function alternarConclusao() {
    tentar(() => executar(concluida ? desmarcarEtapaConcluida(etapa) : marcarEtapaConcluida(etapa)));
  }

  function usarMolde(inicio: string) {
    executar(definirPergunta(inicio));
    selarHistorico();
    campoPergunta.current?.focus();
  }

  const avisos = etapa === 'problema' ? avisosDaPergunta(ciclo?.pergunta ?? '') : [];
  const campos = t.ciclo.conclusao.campos[perfil];

  function campoConclusao(campo: CampoConclusao) {
    const valor = ciclo?.conclusao?.[campo] ?? '';
    return (
      <label className="roteiro-campo" key={campo}>
        <span>{campos[campo]}</span>
        <textarea
          rows={2}
          value={valor}
          onChange={(e) => executar(definirCampoConclusao(campo, e.target.value))}
          onBlur={selarHistorico}
        />
      </label>
    );
  }

  return (
    <section className="faixa-ciclo" data-etapa={etapa} aria-label={t.ciclo.guiaRotulo(t.ciclo.etapas[etapa])}>
      <div className="faixa-linha">
        {abas}
        <div className="faixa-pergunta">
          {etapa === 'problema' ? (
            <>
              <label className="pergunta-campo">
                <span className="pergunta-rotulo">{t.ciclo.pergunta.rotulo}</span>
                <textarea
                  ref={campoPergunta}
                  rows={1}
                  placeholder={t.ciclo.pergunta.placeholder}
                  value={ciclo?.pergunta ?? ''}
                  aria-describedby={avisos.length ? ajudaId : undefined}
                  onChange={(e) => executar(definirPergunta(e.target.value))}
                  onBlur={selarHistorico}
                />
              </label>
              <Menu
                className="moldes"
                icone="seta"
                texto={t.ciclo.pergunta.moldesRotulo}
                rotulo={t.ciclo.pergunta.moldes}
                alinhar="inicio"
                itens={t.ciclo.pergunta.moldesLista.map((m) => ({
                  rotulo: m.rotulo,
                  aria: t.ciclo.pergunta.moldeAria(m.rotulo),
                  aoEscolher: () => usarMolde(m.inicio),
                }))}
              />
            </>
          ) : (
            ciclo?.pergunta.trim() && (
              <p className="pergunta-lembrete" title={ciclo.pergunta}>
                <strong>{t.ciclo.pergunta.rotulo}:</strong> {ciclo.pergunta}
              </p>
            )
          )}
        </div>
        <div className="faixa-acoes" role="group" aria-label={t.ciclo.acoesDaEtapa}>
          {acoes}
          {etapa === 'conclusao' && (
            <button type="button" className="botao-texto" title={t.ciclo.conclusao.novoCicloAjuda} onClick={() => tentar(() => executar(novoCiclo()))}>
              <Icone nome="novoCiclo" tamanho={16} />
              <span className="botao-rotulo">{t.ciclo.conclusao.novoCiclo}</span>
            </button>
          )}
          <button
            type="button"
            className="botao-texto botao-concluir"
            data-concluida={concluida}
            title={concluida ? t.ciclo.desfazerConclusaoEtapa : t.ciclo.concluirEtapa}
            disabled={bloqueada}
            aria-describedby={bloqueada ? ajudaId : undefined}
            onClick={alternarConclusao}
          >
            <Icone nome="check" tamanho={16} />
            <span className="botao-rotulo">{concluida ? t.ciclo.desfazerConclusaoEtapa : t.ciclo.concluirEtapa}</span>
          </button>
        </div>
      </div>

      <div className="faixa-guia">
        <h2 className="guia">{t.ciclo.guia[perfil][etapa]}</h2>
        {avisos.length > 0 && (
          <ul id={ajudaId} className="dicas-pergunta" role="status">
            {avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
        {bloqueada && <span id={ajudaId} className="dica-bloqueio">{t.ciclo.concluirNaoPode}</span>}
        {erro && <span role="alert" className="dica-bloqueio">{erro}</span>}
      </div>

      {etapa === 'conclusao' && (
        <div className="roteiro" role="group" aria-label={t.ciclo.conclusao.roteiro}>
          {campoConclusao('vi')}
          {campoConclusao('mostra')}
          {campoConclusao('naoSei')}
          {campoConclusao('limites')}
        </div>
      )}
      {children}
    </section>
  );
}
