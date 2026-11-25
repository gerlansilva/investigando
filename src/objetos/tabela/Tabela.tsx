import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { Atributo, Id, TipoAtributo } from '../../modelo/tipos';
import { PALETA_ATRIBUTOS, criarAtributo, criarCaso } from '../../modelo/fabrica';
import {
  adicionarAtributo, adicionarCaso, apagarAtributo, apagarCasos, definirFormula, editarCelula,
  mostrarOcultos, ocultarCasos, renomearAtributo,
} from '../../estado/comandos';
import { compilar, recalcularColecao } from '../../formulas';
import type { PropsObjeto } from '../../app/tiposObjeto';
import { useArmazemOpcional } from '../../estado/usarArmazem';
import { converterEntrada, eCalculado, formatarValor, rotuloTipo, tituloAtributo } from '../../app/valoresCelula';
import { t } from '../../i18n/pt-BR';
import { Ferramentas } from '../../app/contextoBarra';
import { Ferramenta } from '../../app/ui';
import './Tabela.css';

export interface EstadoTabela {
  colecaoId: Id;
}

/** Linhas altas nos anos iniciais (alvo de toque de 44 px); mais densas nos anos finais. */
export const ALTURA_LINHA_INICIAIS = 44;
export const ALTURA_LINHA_FINAIS = 32;
const ALTURA_CABECALHO = 56;
const ALTURA_PADRAO_AREA = 400;
const FOLGA_LINHAS = 8;

interface Edicao {
  l: number;
  c: number;
  texto: string;
  erro?: string;
  selecionarTudo: boolean;
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : t.mesa.erroGenerico;
}

function EditorCelula(props: {
  edicao: Edicao;
  rotulo: string;
  aoMudar(texto: string): void;
  aoTeclar(e: KeyboardEvent<HTMLInputElement>): void;
  aoSair(): void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (props.edicao.selecionarTudo) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
    // só ao montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <input
      ref={ref}
      className="tabela-editor"
      data-editor-celula=""
      aria-label={props.rotulo}
      aria-invalid={props.edicao.erro ? true : undefined}
      value={props.edicao.texto}
      onChange={(e) => props.aoMudar(e.target.value)}
      onKeyDown={props.aoTeclar}
      onBlur={props.aoSair}
    />
  );
}

export function Tabela({ objeto, colecao, selecao, aoSelecionar, executar, selarHistorico, perfil }: PropsObjeto<EstadoTabela>) {
  const armazem = useArmazemOpcional();
  const [ativa, setAtiva] = useState<{ l: number; c: number } | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atributoAberto, setAtributoAberto] = useState<Id | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [rolagemTopo, setRolagemTopo] = useState(0);
  const [alturaArea, setAlturaArea] = useState(ALTURA_PADRAO_AREA);
  const [pedidoFoco, setPedidoFoco] = useState(0);
  const [maisADireita, setMaisADireita] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const ancoraRef = useRef<number>(0);
  const canceladoRef = useRef(false);
  const focoPendente = useRef(false);

  const iniciais = perfil === 'iniciais';
  const ALTURA_LINHA = iniciais ? ALTURA_LINHA_INICIAIS : ALTURA_LINHA_FINAIS;
  const atributos = colecao?.atributos ?? [];
  const visiveis = useMemo(() => (colecao ? colecao.casos.filter((c) => !c.oculto) : []), [colecao]);
  const ocultos = colecao ? colecao.casos.length - visiveis.length : 0;
  const indiceNaColecao = useMemo(() => {
    const mapa = new Map<Id, number>();
    colecao?.casos.forEach((c, i) => mapa.set(c.id, i));
    return mapa;
  }, [colecao]);

  // Erros de fórmula: recalcula só para ler os erros (os valores já estão nos casos).
  const globais = armazem?.getState().projeto.globais;
  const calculo = useMemo(() => {
    if (!colecao || !colecao.atributos.some(eCalculado)) return {};
    return recalcularColecao(colecao, globais ?? {}, 0);
  }, [colecao, globais]);
  const errosFormula = useMemo(() => {
    const mapa = new Map<Id, string>();
    for (const [id, r] of Object.entries(calculo)) {
      const primeiro = r.erros.find((e) => e !== null);
      if (primeiro) mapa.set(id, primeiro.mensagem);
    }
    return mapa;
  }, [calculo]);

  function rodar(fabricar: () => ReturnType<typeof apagarCasos>): boolean {
    try {
      executar(fabricar());
      setAviso(null);
      return true;
    } catch (erro) {
      setAviso(mensagemDe(erro));
      return false;
    }
  }

  // ---- rolagem e foco ------------------------------------------------------
  const primeira = Math.max(0, Math.floor(rolagemTopo / ALTURA_LINHA) - FOLGA_LINHAS);
  const ultima = Math.min(visiveis.length, primeira + Math.ceil(alturaArea / ALTURA_LINHA) + 2 * FOLGA_LINHAS);

  function aoRolar() {
    const el = areaRef.current;
    if (!el) return;
    setRolagemTopo(el.scrollTop);
    if (el.clientHeight) setAlturaArea(el.clientHeight);
    medirRolagemHorizontal();
  }

  function medirRolagemHorizontal() {
    const el = areaRef.current;
    if (!el) return;
    setMaisADireita(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  }

  useEffect(() => {
    medirRolagemHorizontal();
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(medirRolagemHorizontal);
    obs.observe(el);
    return () => obs.disconnect();
  });

  useEffect(() => {
    if (!ativa || edicao) return;
    const el = areaRef.current;
    if (el && focoPendente.current) {
      const altura = el.clientHeight || ALTURA_PADRAO_AREA;
      const topo = ativa.l * ALTURA_LINHA;
      if (topo < el.scrollTop) el.scrollTop = topo;
      else if (topo + ALTURA_LINHA > el.scrollTop + altura - ALTURA_CABECALHO) {
        el.scrollTop = topo + ALTURA_LINHA - altura + ALTURA_CABECALHO;
      }
      if (el.scrollTop !== rolagemTopo) setRolagemTopo(el.scrollTop);
    }
    if (!focoPendente.current) return;
    const celula = el?.querySelector<HTMLElement>(`[data-l="${ativa.l}"][data-c="${ativa.c}"]`);
    if (celula) {
      celula.focus({ preventScroll: true });
      focoPendente.current = false;
    }
  }, [ativa, edicao, pedidoFoco, primeira, rolagemTopo]);

  function irPara(l: number, c: number) {
    if (!visiveis.length || !atributos.length) return;
    const ll = Math.min(Math.max(l, 0), visiveis.length - 1);
    const cc = Math.min(Math.max(c, 0), atributos.length - 1);
    focoPendente.current = true;
    setAtiva({ l: ll, c: cc });
    setPedidoFoco((n) => n + 1);
  }

  // ---- seleção ----------------------------------------------------------------
  function selecionarLinha(l: number, e: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>) {
    const caso = visiveis[l];
    if (!caso) return;
    if (e.shiftKey) {
      const de = Math.min(ancoraRef.current, l);
      const ate = Math.max(ancoraRef.current, l);
      aoSelecionar(visiveis.slice(de, ate + 1).map((c) => c.id), 'substituir');
    } else if (e.ctrlKey || e.metaKey) {
      ancoraRef.current = l;
      aoSelecionar([caso.id], 'alternar');
    } else {
      ancoraRef.current = l;
      aoSelecionar([caso.id], 'substituir');
    }
  }

  // ---- edição de célula -------------------------------------------------------
  function iniciarEdicao(l: number, c: number, inicial?: string) {
    const caso = visiveis[l];
    const atributo = atributos[c];
    if (!caso || !atributo) return;
    if (eCalculado(atributo)) {
      setAviso(t.tabela.celulaCalculada);
      return;
    }
    setAviso(null);
    canceladoRef.current = false;
    setAtiva({ l, c });
    setEdicao({
      l,
      c,
      texto: inicial ?? formatarValor(caso.valores[atributo.id], atributo),
      selecionarTudo: inicial === undefined,
    });
  }

  /** Confirma a edição atual. Devolve false se o texto for inválido (a edição continua aberta). */
  function confirmarEdicao(): boolean {
    if (!edicao || !colecao) return true;
    const caso = visiveis[edicao.l];
    const atributo = atributos[edicao.c];
    if (!caso || !atributo) {
      setEdicao(null);
      return true;
    }
    const r = converterEntrada(atributo, edicao.texto);
    if (!r.ok) {
      setEdicao({ ...edicao, erro: r.mensagem });
      setAviso(r.mensagem);
      return false;
    }
    const atual = caso.valores[atributo.id] ?? null;
    if (r.valor !== atual) {
      const ok = rodar(() => editarCelula(colecao.id, caso.id, atributo.id, r.valor));
      selarHistorico();
      if (!ok) return false;
    } else setAviso(null);
    setEdicao(null);
    return true;
  }

  function aoTeclarEditor(e: KeyboardEvent<HTMLInputElement>) {
    if (!edicao) return;
    const { l, c } = edicao;
    if (e.key === 'Escape') {
      e.preventDefault();
      canceladoRef.current = true;
      setEdicao(null);
      setAviso(null);
      irPara(l, c);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (confirmarEdicao()) irPara(l + 1, c);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (!confirmarEdicao()) return;
      const total = atributos.length;
      const proximo = c + (e.shiftKey ? -1 : 1);
      if (proximo >= total) irPara(l + 1, 0);
      else if (proximo < 0) irPara(l - 1, total - 1);
      else irPara(l, proximo);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (confirmarEdicao()) irPara(l + (e.key === 'ArrowDown' ? 1 : -1), c);
    }
  }

  function aoSairEditor() {
    if (canceladoRef.current) {
      canceladoRef.current = false;
      return;
    }
    confirmarEdicao();
  }

  function aoTeclarCelula(e: KeyboardEvent<HTMLElement>, l: number, c: number) {
    if (edicao) return;
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); irPara(l + 1, c); return;
      case 'ArrowUp': e.preventDefault(); irPara(l - 1, c); return;
      case 'ArrowRight': e.preventDefault(); irPara(l, c + 1); return;
      case 'ArrowLeft': e.preventDefault(); irPara(l, c - 1); return;
      case 'Home': e.preventDefault(); irPara(l, 0); return;
      case 'End': e.preventDefault(); irPara(l, atributos.length - 1); return;
      case 'Enter':
      case 'F2': e.preventDefault(); iniciarEdicao(l, c); return;
      case 'Escape': aoSelecionar([], 'limpar'); return;
      case 'Delete':
      case 'Backspace': {
        const caso = visiveis[l];
        const atributo = atributos[c];
        if (!caso || !atributo || !colecao || eCalculado(atributo)) return;
        e.preventDefault();
        if ((caso.valores[atributo.id] ?? null) !== null) {
          rodar(() => editarCelula(colecao.id, caso.id, atributo.id, null));
          selarHistorico();
        }
        return;
      }
      default:
        if (!mod && e.key.length === 1) {
          e.preventDefault();
          iniciarEdicao(l, c, e.key);
        }
    }
  }

  // ---- ações da barra -----------------------------------------------------------
  function novoCaso() {
    if (!colecao) return;
    if (rodar(() => adicionarCaso(colecao.id, criarCaso()))) {
      selarHistorico();
      irPara(visiveis.length, 0);
    }
  }

  function apagarSelecionados() {
    if (!colecao) return;
    const ids = colecao.casos.filter((c) => selecao.has(c.id)).map((c) => c.id);
    if (!ids.length) return;
    if (rodar(() => apagarCasos(colecao.id, ids))) {
      selarHistorico();
      setAtiva(null);
    }
  }

  function esconderSelecionados() {
    if (!colecao) return;
    const ids = colecao.casos.filter((c) => selecao.has(c.id)).map((c) => c.id);
    if (!ids.length) return;
    if (rodar(() => ocultarCasos(colecao.id, ids))) {
      selarHistorico();
      aoSelecionar([], 'limpar');
      setAtiva(null);
    }
  }

  function mostrarTodosOcultos() {
    if (!colecao) return;
    if (rodar(() => mostrarOcultos(colecao.id))) selarHistorico();
  }

  if (!colecao) return <div className="tabela tabela-vazia">{t.tabela.semColecao}</div>;

  const atributoDoPainel = atributos.find((a) => a.id === atributoAberto) ?? null;
  const selecionadosExistentes = colecao.casos.filter((c) => selecao.has(c.id)).length;

  return (
    <div className="tabela" data-perfil={perfil}>
      <Ferramentas rotulo={t.tabela.areaDaTabela}>
        <Ferramenta icone="novoCaso" rotulo={t.tabela.novoCaso} onClick={novoCaso} />
        <Ferramenta icone="novoAtributo" rotulo={t.tabela.novoAtributo} onClick={() => { setNovoAberto((v) => !v); setAtributoAberto(null); }} aria-expanded={novoAberto} />
        <Ferramenta icone="apagar" rotulo={t.tabela.apagarCasos} onClick={apagarSelecionados} disabled={selecionadosExistentes === 0} />
        <Ferramenta icone="esconder" rotulo={t.tabela.esconderSelecionados} onClick={esconderSelecionados} disabled={selecionadosExistentes === 0} />
        {ocultos > 0 && (
          <Ferramenta icone="mostrar" rotulo={t.tabela.mostrarOcultos(ocultos)} onClick={mostrarTodosOcultos} />
        )}
      </Ferramentas>

      {novoAberto && (
        <FormularioNovoAtributo
          perfil={perfil}
          indiceCor={atributos.length}
          aoCriar={(atributo) => {
            if (rodar(() => adicionarAtributo(colecao.id, atributo))) {
              selarHistorico();
              setNovoAberto(false);
            }
          }}
          aoCancelar={() => setNovoAberto(false)}
        />
      )}

      {atributoDoPainel && (
        <PainelAtributo
          key={atributoDoPainel.id}
          atributo={atributoDoPainel}
          iniciais={iniciais}
          confirmando={confirmandoApagar}
          aoConfirmar={setConfirmandoApagar}
          aoFechar={() => { setAtributoAberto(null); setConfirmandoApagar(false); }}
          aoRenomear={(nome) => {
            if (rodar(() => renomearAtributo(colecao.id, atributoDoPainel.id, nome))) selarHistorico();
          }}
          aoDefinirFormula={(formula) => {
            if (rodar(() => definirFormula(colecao.id, atributoDoPainel.id, formula))) selarHistorico();
          }}
          aoApagar={() => {
            if (rodar(() => apagarAtributo(colecao.id, atributoDoPainel.id))) {
              selarHistorico();
              setAtributoAberto(null);
              setConfirmandoApagar(false);
              setAtiva(null);
            }
          }}
        />
      )}

      <div className="tabela-envoltorio" data-mais-a-direita={maisADireita ? 'true' : 'false'} data-testid="envoltorio-tabela">
      <div className="tabela-area" ref={areaRef} onScroll={aoRolar} data-testid="area-tabela">
        <table className="tabela-grade" role="grid" aria-multiselectable="true" aria-label={t.tabela.areaDaTabela}>
          <thead>
            <tr role="row">
              <th className="tabela-num" scope="col">{t.tabela.colunaNumero}</th>
              {atributos.map((a) => (
                <th
                  key={a.id}
                  scope="col"
                  className="tabela-cab"
                                    data-atributo={a.id}
                >
                  <button
                    type="button"
                    className="tabela-cab-botao"
                    aria-expanded={atributoAberto === a.id}
                    onClick={() => { setAtributoAberto(atributoAberto === a.id ? null : a.id); setNovoAberto(false); setConfirmandoApagar(false); }}
                  >
                    <span className="tabela-cab-nome">
                      <span className="tabela-cor" style={{ background: a.cor }} aria-hidden="true" />
                      {tituloAtributo(a)}
                      {errosFormula.has(a.id) && <span className="tabela-alerta" aria-hidden="true"> !</span>}
                      {!iniciais && eCalculado(a) && !errosFormula.has(a.id) && <span className="tabela-formula" aria-hidden="true"> ƒ</span>}
                    </span>{' '}
                    <span className="tabela-cab-tipo">{rotuloTipo(a.tipo)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {primeira > 0 && (
              <tr aria-hidden="true" style={{ height: primeira * ALTURA_LINHA }}><td colSpan={atributos.length + 1} /></tr>
            )}
            {visiveis.slice(primeira, ultima).map((caso, k) => {
              const l = primeira + k;
              const marcada = selecao.has(caso.id);
              const iCol = indiceNaColecao.get(caso.id) ?? l;
              return (
                <tr key={caso.id} role="row" aria-selected={marcada} className={marcada ? 'tabela-linha selecionada' : 'tabela-linha'} data-caso={caso.id} style={{ height: ALTURA_LINHA }}>
                  <th
                    scope="row"
                    className="tabela-num"
                    onClick={(e) => selecionarLinha(l, e)}
                    aria-label={t.tabela.linha(iCol + 1)}
                  >
                    {iCol + 1}
                  </th>
                  {atributos.map((a, c) => {
                    const emEdicao = edicao && edicao.l === l && edicao.c === c;
                    const erroCalc = calculo[a.id]?.erros[iCol] ?? null;
                    const calculada = eCalculado(a);
                    const eAtiva = ativa?.l === l && ativa.c === c;
                    return (
                      <td
                        key={a.id}
                        role="gridcell"
                        data-l={l}
                        data-c={c}
                        tabIndex={eAtiva || (!ativa && l === 0 && c === 0) ? 0 : -1}
                        className={`tabela-celula${eAtiva ? ' ativa' : ''}${calculada ? ' calculada' : ''}${erroCalc ? ' erro' : ''}`}
                        aria-readonly={calculada || undefined}
                        aria-invalid={erroCalc ? true : undefined}
                        title={erroCalc ? erroCalc.mensagem : undefined}
                        onClick={(e) => {
                          if (emEdicao) return;
                          selecionarLinha(l, e);
                          setAtiva({ l, c });
                        }}
                        onDoubleClick={() => iniciarEdicao(l, c)}
                        onKeyDown={(e) => aoTeclarCelula(e, l, c)}
                        onFocus={() => { if (!emEdicao && !eAtiva) setAtiva({ l, c }); }}
                      >
                        {emEdicao && edicao ? (
                          <EditorCelula
                            edicao={edicao}
                            rotulo={t.tabela.editarCelula(a.nome, iCol + 1)}
                            aoMudar={(texto) => setEdicao({ ...edicao, texto, erro: undefined })}
                            aoTeclar={aoTeclarEditor}
                            aoSair={aoSairEditor}
                          />
                        ) : erroCalc ? (
                          <span className="tabela-erro-celula">{t.tabela.erroCelula}</span>
                        ) : (
                          formatarValor(caso.valores[a.id], a)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {ultima < visiveis.length && (
              <tr aria-hidden="true" style={{ height: (visiveis.length - ultima) * ALTURA_LINHA }}><td colSpan={atributos.length + 1} /></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      <div className="tabela-rodape">
        <span className="tabela-contagem" aria-live="polite">
          {t.tabela.casosVisiveis(visiveis.length)}
          {selecionadosExistentes > 0 ? ` · ${t.tabela.casosSelecionados(selecionadosExistentes)}` : ''}
        </span>
      </div>

      {(aviso || errosFormula.size > 0) && (
        <div className="tabela-avisos" role="alert">
          {aviso && <p className="aviso">{aviso}</p>}
          {atributos.filter((a) => errosFormula.has(a.id)).map((a) => (
            <p className="aviso" key={a.id}>{t.tabela.erroNaFormula(a.nome, errosFormula.get(a.id) ?? '')}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------

function FormularioNovoAtributo(props: {
  perfil: 'iniciais' | 'finais';
  indiceCor: number;
  aoCriar(atributo: Atributo): void;
  aoCancelar(): void;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoAtributo>('categorico');
  const [cor, setCor] = useState<string>(PALETA_ATRIBUTOS[props.indiceCor % PALETA_ATRIBUTOS.length]!);
  const [unidade, setUnidade] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const tipos: TipoAtributo[] = props.perfil === 'iniciais' ? ['categorico', 'numerico', 'texto'] : ['categorico', 'numerico', 'texto', 'data'];

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (nome.trim() === '') {
      setErro(t.tabela.nomeObrigatorio);
      return;
    }
    const atributo = criarAtributo({ nome: nome.trim(), tipo, cor });
    if (tipo === 'numerico' && unidade.trim() !== '') atributo.unidade = unidade.trim();
    props.aoCriar(atributo);
  }

  return (
    <form className="tabela-painel" onSubmit={enviar} aria-label={t.tabela.novoAtributo}>
      <label className="campo">
        <span>{t.tabela.nomeDoAtributo}</span>
        <input autoFocus value={nome} onChange={(e) => { setNome(e.target.value); setErro(null); }} />
      </label>
      <label className="campo">
        <span>{t.tabela.tipo}</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAtributo)}>
          {tipos.map((x) => <option key={x} value={x}>{rotuloTipo(x)}</option>)}
        </select>
      </label>
      {tipo === 'numerico' && (
        <label className="campo">
          <span>{t.tabela.unidade}</span>
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        </label>
      )}
      <fieldset className="cores">
        <legend>{t.tabela.cor}</legend>
        {PALETA_ATRIBUTOS.map((c, i) => (
          <label key={c} className="cor-opcao">
            <input type="radio" name="cor-atributo" value={c} checked={cor === c} onChange={() => setCor(c)} aria-label={t.tabela.nomeCor(i + 1)} />
            <span className="cor-amostra" style={{ background: c }} />
          </label>
        ))}
      </fieldset>
      {erro && <p className="aviso" role="alert">{erro}</p>}
      <div className="tabela-painel-acoes">
        <button type="submit" className="botao-pequeno">{t.tabela.criarAtributo}</button>
        <button type="button" className="botao-pequeno" onClick={props.aoCancelar}>{t.tabela.cancelar}</button>
      </div>
    </form>
  );
}

function PainelAtributo(props: {
  atributo: Atributo;
  iniciais: boolean;
  confirmando: boolean;
  aoConfirmar(v: boolean): void;
  aoFechar(): void;
  aoRenomear(nome: string): void;
  aoDefinirFormula(formula: string | undefined): void;
  aoApagar(): void;
}) {
  const { atributo } = props;
  const [nome, setNome] = useState(atributo.nome);
  const [formula, setFormula] = useState(atributo.formula ?? '');
  const [erroFormula, setErroFormula] = useState<string | null>(null);

  function enviarNome(e: FormEvent) {
    e.preventDefault();
    if (nome.trim() !== atributo.nome) props.aoRenomear(nome);
  }

  function enviarFormula(e: FormEvent) {
    e.preventDefault();
    if (formula.trim() === '') {
      setErroFormula(null);
      props.aoDefinirFormula(undefined);
      return;
    }
    const r = compilar(formula);
    if (!r.ok) {
      setErroFormula(r.erro.mensagem);
      return;
    }
    setErroFormula(null);
    props.aoDefinirFormula(formula);
  }

  return (
    <section className="tabela-painel" role="group" aria-label={t.tabela.painelAtributo(atributo.nome)}>
      <form className="linha-form" onSubmit={enviarNome}>
        <label className="campo">
          <span>{t.tabela.nomeDoAtributo}</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <button type="submit" className="botao-pequeno">{t.tabela.renomear}</button>
      </form>

      {!props.iniciais && (
        <form className="linha-form" onSubmit={enviarFormula}>
          <label className="campo">
            <span>{t.tabela.formula}</span>
            <input value={formula} placeholder={t.tabela.formulaAjuda} onChange={(e) => { setFormula(e.target.value); setErroFormula(null); }} aria-invalid={erroFormula ? true : undefined} />
          </label>
          <button type="submit" className="botao-pequeno">{t.tabela.aplicarFormula}</button>
          {atributo.formula && (
            <button type="button" className="botao-pequeno" onClick={() => { setFormula(''); setErroFormula(null); props.aoDefinirFormula(undefined); }}>
              {t.tabela.removerFormula}
            </button>
          )}
          {erroFormula && <p className="aviso" role="alert">{t.tabela.erroNaFormula(atributo.nome, erroFormula)}</p>}
        </form>
      )}

      <div className="tabela-painel-acoes">
        {props.confirmando ? (
          <>
            <span>{t.tabela.confirmarApagarAtributo(atributo.nome)}</span>
            <button type="button" className="botao-pequeno perigo" onClick={props.aoApagar}>{t.mesa.confirmarSim}</button>
            <button type="button" className="botao-pequeno" onClick={() => props.aoConfirmar(false)}>{t.mesa.confirmarNao}</button>
          </>
        ) : (
          <button type="button" className="botao-pequeno perigo" onClick={() => props.aoConfirmar(true)}>{t.tabela.apagarAtributo}</button>
        )}
        <button type="button" className="botao-pequeno" onClick={props.aoFechar}>{t.tabela.fecharPainel}</button>
      </div>
    </section>
  );
}
