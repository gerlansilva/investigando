import { FERRAMENTAS_GRAFICO, ferramentaLigada } from '../../estado/ferramentas';
import { useId, useState, type FormEvent } from 'react';
import {
  ativarModoProfessor, definirEtapaTravada, definirFerramenta, limparFerramentas, definirPin, definirTipoOculto, desativarModoProfessor, ErroComando, fixarPerfil, temPin,
  verificarPin, type Comando,
} from '../../estado/comandos';
import { paraCSV, paraJSON } from '../../estado/registro';
import { useArmazem, useProjeto } from '../../estado/usarArmazem';
import { t } from '../../i18n/pt-BR';
import { ETAPAS, type PerfilFixo, type TipoObjeto } from '../../modelo/tipos';
import type { ControleRegistro } from './usarRegistro';

const TIPOS_CONFIGURAVEIS: readonly TipoObjeto[] = ['tabela', 'fichas', 'grafico', 'simulador', 'texto', 'imagem'];
const MAX_LINHAS = 200;

function baixar(texto: string, nome: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function RegistroTela({ controle }: { controle: ControleRegistro }) {
  const { registro } = controle;
  const [confirmando, setConfirmando] = useState(false);
  const recentes = registro.eventos.slice(-MAX_LINHAS).reverse();
  const dia = new Date().toISOString().slice(0, 10);
  return (
    <section className="professor-secao" aria-label={t.professor.registro.titulo}>
      <h3>{t.professor.registro.titulo}</h3>
      <label className="professor-opcao">
        <input type="checkbox" checked={registro.ativo} onChange={(e) => (e.target.checked ? controle.ligar() : controle.desligar())} />
        <span>{t.professor.registro.ligar}</span>
      </label>
      <p className="professor-dica">{t.professor.registro.dica}</p>
      <p className="professor-dica" role="status">{t.professor.registro.eventos(registro.eventos.length)}</p>
      {recentes.length === 0 ? (
        <p className="professor-dica">{t.professor.registro.vazio}</p>
      ) : (
        <div className="registro-tabela-caixa" tabIndex={0} role="region" aria-label={t.professor.registro.titulo}>
          <table className="registro-tabela">
            <thead>
              <tr><th>{t.professor.registro.momento}</th><th>{t.professor.registro.evento}</th><th>{t.professor.registro.detalhe}</th></tr>
            </thead>
            <tbody>
              {recentes.map((e, i) => (
                <tr key={`${e.t}-${i}`}>
                  <td>{new Date(e.t).toLocaleString('pt-BR')}</td>
                  <td>{t.professor.registro.nomes[e.tipo]}</td>
                  <td>{Object.entries(e.detalhe).map(([k, v]) => `${k}: ${v}`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="professor-linha">
        <button type="button" className="botao-pequeno" disabled={registro.eventos.length === 0} onClick={() => baixar(paraJSON(registro), `registro-investigando-${dia}.json`, 'application/json')}>
          {t.professor.registro.exportarJson}
        </button>
        <button type="button" className="botao-pequeno" disabled={registro.eventos.length === 0} onClick={() => baixar(paraCSV(registro), `registro-investigando-${dia}.csv`, 'text/csv;charset=utf-8')}>
          {t.professor.registro.exportarCsv}
        </button>
        {confirmando ? (
          <span className="professor-confirma" role="alert">
            {t.professor.registro.confirmarLimpar}
            <button type="button" className="botao-pequeno" onClick={() => { controle.limpar(); setConfirmando(false); }}>{t.professor.registro.sim}</button>
            <button type="button" className="botao-pequeno" onClick={() => setConfirmando(false)}>{t.professor.registro.nao}</button>
          </span>
        ) : (
          <button type="button" className="botao-pequeno" disabled={registro.eventos.length === 0} onClick={() => setConfirmando(true)}>
            {t.professor.registro.limpar}
          </button>
        )}
      </div>
    </section>
  );
}

/** Botão discreto "Professor" na barra e o cartão com o modo professor e o registro de pesquisa. */
export function Professor({ registro, perfil = 'iniciais' }: { registro: ControleRegistro; perfil?: 'iniciais' | 'finais' }) {
  const armazem = useArmazem();
  const projeto = useProjeto();
  const idPin = useId();
  const [aberto, setAberto] = useState(false);
  const [destravado, setDestravado] = useState(false);
  const [pin, setPin] = useState('');
  /** PIN já conferido nesta abertura do painel (só na memória), usado para trocar/remover o PIN e desativar. */
  const [pinSessao, setPinSessao] = useState<string | undefined>(undefined);
  const [novoPin, setNovoPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const pr = projeto.professor;
  const ativo = !!pr?.ativo;
  const protegido = ativo && temPin(projeto) && !destravado;

  function aplicar(fazer: () => Comando): boolean {
    try {
      armazem.getState().executarSemHistorico(fazer());
      setErro(null);
      return true;
    } catch (e) {
      setErro(e instanceof ErroComando ? e.message : t.mesa.erroGenerico);
      return false;
    }
  }

  function entrar(e: FormEvent) {
    e.preventDefault();
    if (verificarPin(projeto, pin)) {
      setDestravado(true);
      setPinSessao(pin);
      setPin('');
      setErro(null);
    } else setErro(t.professor.pinErrado);
  }

  function ativar(e: FormEvent) {
    e.preventDefault();
    const digitado = pin.trim();
    if (aplicar(() => ativarModoProfessor(digitado ? { pin: digitado } : {}))) {
      setDestravado(true);
      setPinSessao(digitado || undefined);
      setPin('');
    }
  }

  function desativar() {
    if (aplicar(() => desativarModoProfessor(pinSessao))) {
      setDestravado(false);
      setPinSessao(undefined);
    }
  }

  function fechar() {
    setAberto(false);
    setDestravado(false);
    setPinSessao(undefined);
    setPin('');
    setErro(null);
  }

  return (
    <div className="professor">
      <button type="button" className="botao-texto professor-botao" aria-expanded={aberto} aria-haspopup="dialog" data-ativo={ativo} onClick={() => (aberto ? fechar() : setAberto(true))}>
        {t.professor.botao}
      </button>
      {aberto && (
        <div className="professor-cartao" role="dialog" aria-label={t.professor.titulo}>
          <header className="professor-cabeca">
            <h2>{t.professor.titulo}</h2>
            <button type="button" className="botao-pequeno" onClick={fechar} aria-label={t.professor.fechar}>{t.professor.fecharTexto}</button>
          </header>
          {erro && <p className="professor-erro" role="alert">{erro}</p>}

          {protegido ? (
            <form className="professor-secao" onSubmit={entrar}>
              <label className="professor-campo" htmlFor={idPin}>{t.professor.pinPedido}</label>
              <input id={idPin} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
              <button type="submit" className="botao-pequeno">{t.professor.entrar}</button>
            </form>
          ) : (
            <>
              {!ativo ? (
                <form className="professor-secao" onSubmit={ativar}>
                  <p className="professor-dica">{t.professor.ativoDica}</p>
                  <label className="professor-campo" htmlFor={idPin}>{t.professor.pinOpcional}</label>
                  <input id={idPin} type="password" inputMode="numeric" autoComplete="off" placeholder={t.professor.pinCampo} value={pin} onChange={(e) => setPin(e.target.value)} />
                  <button type="submit" className="botao-pequeno">{t.professor.ativar}</button>
                </form>
              ) : (
                <section className="professor-secao" aria-label={t.professor.titulo}>
                  <p className="professor-dica">{t.professor.ativoDica}</p>
                  <fieldset className="professor-grupo">
                    <legend>{t.professor.etapasTravadas}</legend>
                    {ETAPAS.map((etapa) => (
                      <label key={etapa} className="professor-opcao">
                        <input type="checkbox" checked={pr!.etapasTravadas.includes(etapa)} onChange={(e) => aplicar(() => definirEtapaTravada(etapa, e.target.checked))} />
                        <span>{t.ciclo.etapas[etapa]}</span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="professor-grupo">
                    <legend>{t.professor.objetosOcultos}</legend>
                    {TIPOS_CONFIGURAVEIS.map((tipo) => (
                      <label key={tipo} className="professor-opcao">
                        <input type="checkbox" checked={pr!.tiposOcultos.includes(tipo)} onChange={(e) => aplicar(() => definirTipoOculto(tipo, e.target.checked))} />
                        <span>{t.mesa.nomeObjeto[tipo]}</span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="professor-grupo">
                    <legend>{t.professor.ferramentas}</legend>
                    <p className="professor-dica">{t.professor.ferramentasDica}</p>
                    {FERRAMENTAS_GRAFICO.map((id) => (
                      <label key={id} className="professor-opcao">
                        <input type="checkbox" checked={ferramentaLigada(pr!.perfilFixo ?? perfil, pr!.ferramentas, id)} onChange={(e) => aplicar(() => definirFerramenta(id, e.target.checked))} />
                        <span>{t.professor.nomeFerramenta[id]}</span>
                      </label>
                    ))}
                    <button type="button" className="botao-pequeno" disabled={!pr!.ferramentas} onClick={() => aplicar(() => limparFerramentas())}>{t.professor.ferramentasPadrao}</button>
                  </fieldset>
                  <label className="professor-opcao">
                    <span>{t.professor.perfilFixo}</span>
                    <select value={pr!.perfilFixo ?? ''} onChange={(e) => aplicar(() => fixarPerfil((e.target.value || null) as PerfilFixo | null))}>
                      <option value="">{t.professor.perfilLivre}</option>
                      <option value="iniciais">{t.app.perfilIniciais}</option>
                      <option value="finais">{t.app.perfilFinais}</option>
                    </select>
                  </label>
                  <div className="professor-linha">
                    <input type="password" inputMode="numeric" autoComplete="off" aria-label={t.professor.novoPin} placeholder={t.professor.novoPin} value={novoPin} onChange={(e) => setNovoPin(e.target.value)} />
                    <button type="button" className="botao-pequeno" disabled={!novoPin} onClick={() => { if (aplicar(() => definirPin(novoPin, undefined))) setNovoPin(''); }}>
                      {t.professor.definirPin}
                    </button>
                    {temPin(projeto) && (
                      <button type="button" className="botao-pequeno" onClick={() => aplicar(() => { setPinSessao(undefined); return definirPin(null, pinSessao); })}>{t.professor.removerPin}</button>
                    )}
                  </div>
                  <div className="professor-linha">
                    <button type="button" className="botao-pequeno" onClick={desativar}>{t.professor.desativar}</button>
                  </div>
                </section>
              )}
              <RegistroTela controle={registro} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
