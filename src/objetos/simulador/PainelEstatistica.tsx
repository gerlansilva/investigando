import { t } from '../../i18n/pt-BR';
import { dispositivoDoEstado, nomesPossiveis } from '../../simulador';
import { CampoNumero } from './CampoNumero';
import type { PropsPainel } from './tiposPainel';

const s = t.simulador;

interface Props extends PropsPainel {
  rodando: boolean;
  aoColetar(): void;
}

/** "Coletar estatística". Anos iniciais: contar um valor escolhido numa lista (sem fórmulas). */
export function PainelEstatistica({ estado, mudar, selar, perfil, rodando, aoColetar }: Props) {
  const simples = perfil === 'iniciais';
  const e = estado.estatistica;
  const trocar = (parcial: Partial<typeof e>) => mudar({ estatistica: { ...e, ...parcial } });
  const efetivo = simples && estado.dispositivo === 'contador' ? 'roleta' : estado.dispositivo;
  const nomes = nomesPossiveis(dispositivoDoEstado({ ...estado, dispositivo: efetivo }));

  return (
    <div className="simulador-painel">
      <fieldset className="simulador-grupo" disabled={rodando}>
        {simples ? (
          <label className="simulador-campo">
            {s.contarValor}
            <select value={nomes.includes(e.valorContado) ? e.valorContado : (nomes[0] ?? '')} onChange={(ev) => { trocar({ valorContado: ev.target.value }); selar(); }}>
              {nomes.map((n, i) => (
                <option key={`${n}-${i}`} value={n}>{n}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="simulador-campo">
              {s.formulaEstatistica}
              <input className="simulador-texto" type="text" value={e.formula} placeholder={s.formulaPlaceholder} aria-describedby="simulador-formula-ajuda" onChange={(ev) => trocar({ formula: ev.target.value })} onBlur={selar} />
            </label>
            <small id="simulador-formula-ajuda">{s.formulaAjuda}</small>
            <label className="simulador-campo">
              {s.rotuloEstatistica}
              <input className="simulador-texto" type="text" value={e.rotulo} onChange={(ev) => trocar({ rotulo: ev.target.value })} onBlur={selar} />
            </label>
          </>
        )}

        {!(!simples && e.usarRodarAteQue) && (
          <label className="simulador-campo">
            {s.repeticoesEstatistica}
            <CampoNumero rotulo={s.repeticoesEstatistica} valor={e.repeticoes} aoMudar={(n) => trocar({ repeticoes: n })} aoSair={selar} />
          </label>
        )}

        {!simples && (
          <>
            <label className="simulador-marca">
              <input type="checkbox" checked={e.usarRodarAteQue} onChange={(ev) => { trocar({ usarRodarAteQue: ev.target.checked }); selar(); }} />
              {s.rodarAteQue}
            </label>
            {e.usarRodarAteQue && (
              <>
                <label className="simulador-campo">
                  {s.condicaoParada}
                  <input className="simulador-texto" type="text" value={e.rodarAteQue} placeholder={s.condicaoPlaceholder} onChange={(ev) => trocar({ rodarAteQue: ev.target.value })} onBlur={selar} />
                </label>
                <label className="simulador-campo">
                  {s.limiteSeguranca}
                  <CampoNumero rotulo={s.limiteSeguranca} valor={e.limite} aoMudar={(n) => trocar({ limite: n })} aoSair={selar} />
                </label>
              </>
            )}
          </>
        )}
      </fieldset>
      <button type="button" className="simulador-botao simulador-botao--destaque" disabled={rodando} onClick={aoColetar}>
        {s.coletar}
      </button>
    </div>
  );
}
