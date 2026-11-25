import { PALETA_ATRIBUTOS } from '../../modelo/fabrica';
import { t } from '../../i18n/pt-BR';
import { VELOCIDADES, type Velocidade } from '../../simulador';
import { CampoNumero } from './CampoNumero';
import type { PropsPainel } from './tiposPainel';

const s = t.simulador;
const cor = (i: number) => PALETA_ATRIBUTOS[i % PALETA_ATRIBUTOS.length]!;

export function PainelDispositivo({ estado, mudar, selar, perfil }: PropsPainel) {
  const simples = perfil === 'iniciais';
  const dispositivo = simples && estado.dispositivo === 'contador' ? 'roleta' : estado.dispositivo;

  const setores = estado.roleta.setores;
  const trocarSetor = (i: number, parcial: Partial<(typeof setores)[number]>) =>
    mudar({ roleta: { setores: setores.map((x, k) => (k === i ? { ...x, ...parcial } : x)) } });

  const { bolas } = estado.misturador;
  const trocarBola = (i: number, parcial: Partial<(typeof bolas)[number]>) =>
    mudar({ misturador: { ...estado.misturador, bolas: bolas.map((x, k) => (k === i ? { ...x, ...parcial } : x)) } });

  const totalSetores = setores.reduce((a, x) => a + (x.proporcao > 0 ? x.proporcao : 0), 0);

  return (
    <div className="simulador-painel">
      {dispositivo === 'roleta' && (
        <ul className="simulador-lista" aria-label={s.dispositivos.roleta}>
          {setores.map((x, i) => (
            <li key={i} className="simulador-linha">
              <input type="color" className="simulador-cor" aria-label={s.corDe(s.setor(i + 1))} value={x.cor} onChange={(e) => trocarSetor(i, { cor: e.target.value })} onBlur={selar} />
              <input className="simulador-texto" type="text" aria-label={s.nomeDe(s.setor(i + 1))} value={x.nome} onChange={(e) => trocarSetor(i, { nome: e.target.value })} onBlur={selar} />
              <CampoNumero rotulo={s.proporcaoDe(s.setor(i + 1))} valor={x.proporcao} aoMudar={(n) => trocarSetor(i, { proporcao: n })} aoSair={selar} />
              <span className="simulador-porcento" aria-hidden="true">{x.proporcao > 0 && totalSetores > 0 ? s.resumoPorcento((x.proporcao / totalSetores) * 100) : ''}</span>
              <button type="button" className="simulador-botao-pequeno" aria-label={s.removerDe(s.setor(i + 1))} onClick={() => { mudar({ roleta: { setores: setores.filter((_, k) => k !== i) } }); selar(); }}>×</button>
            </li>
          ))}
          <li>
            <button type="button" className="simulador-botao" onClick={() => { mudar({ roleta: { setores: [...setores, { nome: s.novoSetor(setores.length + 1), proporcao: 1, cor: cor(setores.length) }] } }); selar(); }}>
              {s.adicionarSetor}
            </button>
          </li>
        </ul>
      )}

      {dispositivo === 'misturador' && (
        <>
          <ul className="simulador-lista" aria-label={s.dispositivos.misturador}>
            {bolas.map((x, i) => (
              <li key={i} className="simulador-linha">
                <input type="color" className="simulador-cor" aria-label={s.corDe(s.bola(i + 1))} value={x.cor} onChange={(e) => trocarBola(i, { cor: e.target.value })} onBlur={selar} />
                <input className="simulador-texto" type="text" aria-label={s.nomeDe(s.bola(i + 1))} value={x.nome} onChange={(e) => trocarBola(i, { nome: e.target.value })} onBlur={selar} />
                <CampoNumero rotulo={s.quantidadeDe(s.bola(i + 1))} valor={x.quantidade} aoMudar={(n) => trocarBola(i, { quantidade: n })} aoSair={selar} />
                <button type="button" className="simulador-botao-pequeno" aria-label={s.removerDe(s.bola(i + 1))} onClick={() => { mudar({ misturador: { ...estado.misturador, bolas: bolas.filter((_, k) => k !== i) } }); selar(); }}>×</button>
              </li>
            ))}
            <li>
              <button type="button" className="simulador-botao" onClick={() => { mudar({ misturador: { ...estado.misturador, bolas: [...bolas, { nome: s.novaBola(bolas.length + 1), quantidade: 1, cor: cor(bolas.length + 2) }] } }); selar(); }}>
                {s.adicionarBola}
              </button>
            </li>
          </ul>
          <label className="simulador-marca">
            <input type="checkbox" checked={estado.misturador.reposicao} onChange={(e) => { mudar({ misturador: { ...estado.misturador, reposicao: e.target.checked } }); selar(); }} />
            {s.reposicao}
          </label>
          {!estado.misturador.reposicao && (
            <label className="simulador-marca">
              <input type="checkbox" checked={estado.misturador.reporEntreRepeticoes} onChange={(e) => { mudar({ misturador: { ...estado.misturador, reporEntreRepeticoes: e.target.checked } }); selar(); }} />
              {s.reporEntreRepeticoes}
            </label>
          )}
        </>
      )}

      {dispositivo === 'contador' && (
        <div className="simulador-linha simulador-linha--coluna">
          <label className="simulador-campo">
            {s.contadorModo}
            <select value={estado.contador.modo} onChange={(e) => { mudar({ contador: { ...estado.contador, modo: e.target.value as 'ate' | 'lista' } }); selar(); }}>
              <option value="ate">{s.contadorModoAte}</option>
              <option value="lista">{s.contadorModoLista}</option>
            </select>
          </label>
          {estado.contador.modo === 'ate' ? (
            <label className="simulador-campo">
              {s.contadorAte}
              <CampoNumero rotulo={s.contadorAte} valor={estado.contador.ate} aoMudar={(n) => mudar({ contador: { ...estado.contador, ate: n } })} aoSair={selar} />
            </label>
          ) : (
            <label className="simulador-campo">
              {s.contadorLista}
              <input className="simulador-texto" type="text" value={estado.contador.valores} onChange={(e) => mudar({ contador: { ...estado.contador, valores: e.target.value } })} onBlur={selar} />
            </label>
          )}
        </div>
      )}

      <div className="simulador-linha simulador-linha--grade">
        <label className="simulador-campo">
          {s.itensPorRepeticao}
          <CampoNumero rotulo={s.itensPorRepeticao} valor={estado.itensPorRepeticao} aoMudar={(n) => mudar({ itensPorRepeticao: n })} aoSair={selar} />
        </label>
        <label className="simulador-campo">
          {s.repeticoes}
          <CampoNumero rotulo={s.repeticoes} valor={estado.repeticoes} aoMudar={(n) => mudar({ repeticoes: n })} aoSair={selar} />
        </label>
        <label className="simulador-campo">
          {s.velocidade}
          <select value={estado.velocidade} onChange={(e) => { mudar({ velocidade: e.target.value as Velocidade }); selar(); }}>
            {VELOCIDADES.map((v) => (
              <option key={v} value={v}>{s.velocidades[v]}</option>
            ))}
          </select>
        </label>
        {!simples && (
          <label className="simulador-campo">
            {s.semente}
            <input
              className="simulador-numero"
              type="text"
              inputMode="numeric"
              size={10}
              value={estado.semente === undefined ? '' : String(estado.semente)}
              aria-describedby="simulador-semente-ajuda"
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                mudar({ semente: Number.isFinite(n) && n >= 0 ? n : undefined, rodada: 0 });
              }}
              onBlur={selar}
            />
          </label>
        )}
        {!simples && (
          <small id="simulador-semente-ajuda">{s.sementeAjuda}</small>
        )}
      </div>
    </div>
  );
}
