import { useEffect } from 'react';
import { cicloCorrente } from '../../estado/comandos';
import { useProjeto } from '../../estado/usarArmazem';
import { t } from '../../i18n/pt-BR';
import { ETAPAS } from '../../modelo/tipos';

export function Resumo({ aoFechar }: { aoFechar(): void }) {
  const projeto = useProjeto();
  const ciclo = cicloCorrente(projeto);
  const r = t.ciclo.resumoPainel;
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    document.addEventListener('keydown', fechar);
    return () => document.removeEventListener('keydown', fechar);
  }, [aoFechar]);
  const anteriores = projeto.ciclos.filter((c) => c !== ciclo);
  const concluidas = ETAPAS.filter((e) => ciclo?.etapasConcluidas.includes(e)).map((e) => t.ciclo.etapas[e]);
  return (
    <aside className="resumo" role="region" aria-label={t.ciclo.resumo}>
      <header>
        <h2>{r.titulo}{ciclo ? ` — ${r.cicloN(ciclo.n)}` : ''}</h2>
        <button type="button" className="botao-pequeno" onClick={aoFechar}>{t.ciclo.fecharResumo}</button>
      </header>
      <dl className="resumo-grade">
        <div className="resumo-card">
          <dt>{r.pergunta}</dt>
          <dd data-testid="resumo-pergunta">{ciclo?.pergunta.trim() || r.semPergunta}</dd>
        </div>
        <div className="resumo-card">
          <dt>{r.concluidas}</dt>
          <dd>{concluidas.length ? concluidas.join(', ') : r.nenhuma}</dd>
        </div>
        <div className="resumo-card resumo-card--largo">
          <dt>{r.objetos}</dt>
          <dd>
            <ul className="resumo-objetos">
              {ETAPAS.map((e) => (
                <li key={e} data-etapa={e}>
                  <span>{t.ciclo.etapas[e]}:</span> {r.objetosEtapa(projeto.objetos.filter((o) => o.etapa === e).length)}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="resumo-card resumo-card--largo">
          <dt>{r.conclusao}</dt>
          <dd data-testid="resumo-conclusao">{ciclo?.conclusao?.texto.trim() || r.semConclusao}</dd>
        </div>
        {ciclo?.conclusao?.limites.trim() && (
          <div className="resumo-card resumo-card--largo">
            <dt>{r.limites}</dt>
            <dd data-testid="resumo-limites">{ciclo.conclusao.limites}</dd>
          </div>
        )}
        {anteriores.length > 0 && (
          <div className="resumo-card resumo-card--largo">
            <dt>{r.anteriores}</dt>
            <dd>
              <ul>
                {anteriores.map((c) => <li key={c.n}>{r.cicloN(c.n)}: {c.pergunta.trim() || r.semPergunta}</li>)}
              </ul>
            </dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
