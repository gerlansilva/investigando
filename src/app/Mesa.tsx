import { useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as PointerReact } from 'react';
import type { Colecao, EtapaCiclo, Id, ObjetoMesa, TipoObjeto } from '../modelo/tipos';
import { criarAtributo, criarColecao, criarObjeto as fabricarObjeto } from '../modelo/fabrica';
import { apagarObjeto, criarObjeto, limitesDoProfessor, moverObjeto, redimensionarObjeto, renomearObjeto } from '../estado/comandos';
import { useAcoes, useEstado, useProjeto, useRotulosHistorico } from '../estado/usarArmazem';
import { t } from '../i18n/pt-BR';
import { estadoPadrao } from '../objetos/grafico/estado';
import { criarObjetoComColecao, moverObjetos } from './comandosMesa';
import { ContextoBarra, ContextoObjeto, Encaixar } from './contextoBarra';
import { Icone, type NomeIcone } from './icones';
import { Ferramenta, GrupoNomeado, Menu, Separador } from './ui';
import { BASES, type BaseDeDados } from '../dados/bases';
import { colecaoDaBase } from '../dados/colecaoDaBase';
import { MODELOS } from '../dados/modelos';
import { colecaoDeCsv } from '../dados/csv';
import { organizarEmFileiras, posicaoLivre, type Caixa } from './organizar';
import { criadorDe, sugeridosDa, tiposComCriador } from './ciclo/objetosSugeridos';
import { obterTipoObjeto } from './registro';
import type { ModoSelecaoObjeto, PerfilEnsino } from './tiposObjeto';
import './estilos.css';

const LARGURA_MINIMA = 200;
const ALTURA_MINIMA = 120;
const PASSO_TECLADO = 10;

const NOVOS: readonly TipoObjeto[] = ['tabela', 'fichas', 'grafico', 'simulador', 'texto', 'imagem'];
const TAMANHOS_NOVOS: Partial<Record<TipoObjeto, { l: number; a: number }>> = {
  grafico: { l: 720, a: 440 },
  simulador: { l: 560, a: 500 },
};
const LARGURA_PADRAO_MESA = 1200;
const ICONES_TIPO: Partial<Record<TipoObjeto, NomeIcone>> = {
  tabela: 'tabela', fichas: 'fichas', grafico: 'grafico', simulador: 'simulador', texto: 'texto', imagem: 'imagem',
};
const VAZIO: ReadonlySet<Id> = new Set<Id>();

function colecaoDoObjeto(o: ObjetoMesa, colecoes: Colecao[]): Colecao | undefined {
  const id = (o.estado as { colecaoId?: Id } | null | undefined)?.colecaoId;
  return id === undefined ? undefined : colecoes.find((c) => c.id === id);
}

function tituloDoObjeto(o: ObjetoMesa, colecao: Colecao | undefined): string {
  if (o.titulo) return o.titulo;
  const base = t.mesa.nomeObjeto[o.tipo];
  return (o.tipo === 'tabela' || o.tipo === 'fichas') && colecao ? `${base}: ${colecao.nome}` : base;
}

interface GestoAtivo {
  tipo: 'mover' | 'redimensionar';
  pointerId: number;
  inicioX: number;
  inicioY: number;
  x0: number;
  y0: number;
  l0: number;
  a0: number;
}

export interface PropsMesa {
  perfil?: PerfilEnsino;
  /** Mostra só os objetos desta etapa; sem valor (ou null) mostra todos (mesa livre). */
  filtroEtapa?: EtapaCiclo | null;
}

export function Mesa({ perfil = 'iniciais', filtroEtapa = null }: PropsMesa) {
  const projeto = useProjeto();
  const selecaoCasos = useEstado((s) => s.selecaoCasos);
  const { executar, desfazer, refazer, selarHistorico, selecionarCasos, limparSelecao, focarObjeto } = useAcoes();
  const rotulos = useRotulosHistorico();
  const [ordem, setOrdem] = useState<Id[]>([]);
  const [apagando, setApagando] = useState<Id | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const focadoId = useEstado((s) => s.objetoFocado);
  const encaixes = useContext(ContextoBarra);
  const [encaixeLocal, setEncaixeLocal] = useState<HTMLElement | null>(null);
  const encaixeContextual = encaixes?.contextual ?? encaixeLocal;
  const mesaRef = useRef<HTMLDivElement>(null);
  const entradaCsv = useRef<HTMLInputElement>(null);
  const focadoRef = useRef(focadoId);
  focadoRef.current = focadoId;

  const focar = useCallback((id: Id) => {
    setOrdem((o) => (o[o.length - 1] === id ? o : [...o.filter((x) => x !== id), id]));
    focarObjeto(id);
  }, [focarObjeto]);

  // Atalhos globais de desfazer/refazer.
  useEffect(() => {
    function aoTeclar(e: globalThis.KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const alvo = e.target instanceof HTMLElement ? e.target : null;
      if (alvo?.hasAttribute('data-editor-celula')) return; // edição de célula usa o desfazer do campo
      const tecla = e.key.toLowerCase();
      if (tecla === 'z' && !e.shiftKey) {
        e.preventDefault();
        desfazer();
      } else if ((tecla === 'z' && e.shiftKey) || tecla === 'y') {
        e.preventDefault();
        refazer();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [desfazer, refazer]);

  const etapaNova: EtapaCiclo = projeto.cicloAtual;
  const visiveis = filtroEtapa ? projeto.objetos.filter((o) => o.etapa === filtroEtapa) : projeto.objetos;
  const limites = limitesDoProfessor(projeto);
  const ocultos = limites.tiposOcultos;
  const tiposNovos: TipoObjeto[] = [...NOVOS, ...tiposComCriador().filter((x) => !NOVOS.includes(x))].filter((x) => !ocultos.includes(x));

  // Ao chegar numa etapa (ou quando os quadros dela mudam), o primeiro quadro fica focado para mostrar as ferramentas dele.
  const idsVisiveis = visiveis.map((o) => o.id).join('|');
  useEffect(() => {
    const primeiro = idsVisiveis.split('|')[0];
    if (!primeiro) return;
    const atual = focadoRef.current;
    if (atual && idsVisiveis.split('|').includes(atual)) return;
    focarObjeto(primeiro);
  }, [idsVisiveis, focarObjeto]);

  function larguraDaMesa(): number {
    return mesaRef.current?.clientWidth || LARGURA_PADRAO_MESA;
  }

  /** Quadros que o objeto novo precisa evitar: os da etapa dele (todos, se a mesa está livre). */
  function caixasOcupadas(): Caixa[] {
    return projeto.objetos
      .filter((o) => !filtroEtapa || o.etapa === etapaNova)
      .map((o) => ({ x: o.x, y: o.y, l: o.l, a: o.a }));
  }

  /** Põe na mesa uma tabela com a coleção e um quadro de texto com os créditos (um só passo no desfazer). */
  function usarColecao(colecao: Colecao, creditos: string) {
    try {
      const modelo = fabricarObjeto('tabela', {});
      const caixas = caixasOcupadas();
      const pos = posicaoLivre(caixas, modelo.l, modelo.a, larguraDaMesa());
      const tabela = fabricarObjeto('tabela', { ...pos, etapa: 'dados', estado: { colecaoId: colecao.id } });
      executar(criarObjetoComColecao(`Adicionar dados '${colecao.nome}'`, colecao, tabela));
      const modeloTexto = fabricarObjeto('texto', { l: 440, a: 220 });
      const pos2 = posicaoLivre([...caixas, { x: tabela.x, y: tabela.y, l: tabela.l, a: tabela.a }], modeloTexto.l, modeloTexto.a, larguraDaMesa());
      executar(criarObjeto(fabricarObjeto('texto', { ...pos2, l: 440, a: 220, etapa: 'dados', estado: { texto: creditos } })));
      selarHistorico();
      focar(tabela.id);
      mostrarObjeto(tabela.id);
      setAviso(t.mesa.bases.aviso(colecao.nome));
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : t.mesa.erroGenerico);
    }
  }

  function usarBase(base: BaseDeDados) {
    usarColecao(colecaoDaBase(base), base.linhas.length === 0 ? t.mesa.bases.modeloDica : t.mesa.bases.creditos(base.fonte, base.licenca));
  }

  async function importarCsv(arquivo: File) {
    try {
      const nome = arquivo.name.replace(/\.[^.]+$/, '');
      usarColecao(colecaoDeCsv(await arquivo.text(), nome), t.mesa.bases.creditosImportado(arquivo.name));
    } catch (erro) {
      setAviso(erro instanceof Error && erro.message ? erro.message : t.mesa.bases.erroLeitura);
    }
  }

  function organizar() {
    const alvos = projeto.objetos.filter((o) => visiveis.some((v) => v.id === o.id));
    if (alvos.length === 0) return;
    executar(moverObjetos(organizarEmFileiras(alvos, larguraDaMesa())));
    selarHistorico();
  }

  /** Leva o objeto recém-criado para a área visível da mesa. */
  function mostrarObjeto(id: Id) {
    requestAnimationFrame(() => {
      const el = mesaRef.current?.querySelector(`[data-objeto="${id}"]`);
      el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
  }

  /** `reusarColecao`: nos convites das etapas, a tabela nova usa os mesmos dados que já existem. */
  function novoObjeto(tipo: TipoObjeto, opcoes: { reusarColecao?: boolean } = {}) {
    try {
      const modelo = fabricarObjeto(tipo, TAMANHOS_NOVOS[tipo] ?? {});
      const posicao = posicaoLivre(caixasOcupadas(), modelo.l, modelo.a, larguraDaMesa());
      const estadoBase: Record<string, unknown> = {};
      let objeto: ObjetoMesa;
      const criador = criadorDe(tipo);
      if (criador) {
        const focado = projeto.objetos.find((o) => o.id === focadoId);
        const ligada = (focado && colecaoDoObjeto(focado, projeto.colecoes)) || projeto.colecoes[0];
        const r = criador({ projeto, etapa: etapaNova, posicao, colecaoId: ligada?.id });
        if (!r) return;
        executar(r.comando);
        selarHistorico();
        focar(r.objeto.id);
        mostrarObjeto(r.objeto.id);
        setAviso(null);
        return;
      }
      if (tipo === 'tabela' && opcoes.reusarColecao && projeto.colecoes.length > 0) {
        const focado = projeto.objetos.find((o) => o.id === focadoId);
        const ligada = (focado && colecaoDoObjeto(focado, projeto.colecoes)) || projeto.colecoes[0]!;
        objeto = fabricarObjeto(tipo, { ...posicao, etapa: etapaNova, estado: { colecaoId: ligada.id } });
        executar(criarObjeto(objeto));
      } else if (tipo === 'tabela' || (tipo === 'fichas' && projeto.colecoes.length === 0)) {
        const colecao = criarColecao(t.mesa.nomeColecaoNova(projeto.colecoes.length + 1), [
          criarAtributo({ nome: t.mesa.atributoNomeInicial, tipo: 'texto', indiceCor: 0 }),
        ]);
        objeto = fabricarObjeto(tipo, { ...posicao, etapa: etapaNova, estado: { ...estadoBase, colecaoId: colecao.id } });
        executar(criarObjetoComColecao(`Criar ${t.mesa.nomeObjeto[tipo].toLowerCase()}`, colecao, objeto));
      } else {
        if (tipo === 'fichas') {
          const focado = projeto.objetos.find((o) => o.id === focadoId);
          const ligada = (focado && colecaoDoObjeto(focado, projeto.colecoes)) || projeto.colecoes[0];
          estadoBase.colecaoId = ligada?.id;
        }
        if (tipo === 'texto') estadoBase.texto = '';
        if (tipo === 'grafico') {
          const focado = projeto.objetos.find((o) => o.id === focadoId);
          const ligada = (focado && colecaoDoObjeto(focado, projeto.colecoes)) || projeto.colecoes[0];
          if (!ligada) {
            setAviso(t.mesa.semColecaoParaGrafico);
            return;
          }
          Object.assign(estadoBase, estadoPadrao(ligada.id));
          // pontos já nascem coloridos: usa o primeiro atributo de categoria
          const categoria = ligada.atributos.find((a) => a.tipo === 'categorico');
          if (categoria) estadoBase.corPor = categoria.id;
        }
        objeto = fabricarObjeto(tipo, { ...posicao, ...(TAMANHOS_NOVOS[tipo] ?? {}), etapa: etapaNova, estado: estadoBase });
        executar(criarObjeto(objeto));
      }
      selarHistorico();
      focar(objeto.id);
      mostrarObjeto(objeto.id);
      setAviso(null);
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : t.mesa.erroGenerico);
    }
  }

  function aoSelecionarDe(colecaoId: Id | undefined) {
    return (ids: Id[], modo: ModoSelecaoObjeto) => {
      if (colecaoId === undefined) return;
      if (modo === 'limpar') limparSelecao(colecaoId);
      else selecionarCasos(colecaoId, ids, modo);
    };
  }

  const grupoHistorico = (
      <div className="barra-grupo" role="group" aria-label={t.mesa.historico}>
        <Ferramenta
          icone="desfazer"
          rotulo={t.mesa.desfazer}
          detalhe={`: ${rotulos.desfazer ? rotulos.desfazer.replace(/^Desfazer:\s*/, '') : t.mesa.nadaParaDesfazer}`}
          title={rotulos.desfazer ?? t.mesa.nadaParaDesfazer}
          onClick={desfazer}
          disabled={!rotulos.desfazer}
          aria-keyshortcuts="Control+Z Meta+Z"
        />
        <Ferramenta
          icone="refazer"
          rotulo={t.mesa.refazer}
          detalhe={`: ${rotulos.refazer ? rotulos.refazer.replace(/^Refazer:\s*/, '') : t.mesa.nadaParaRefazer}`}
          title={rotulos.refazer ?? t.mesa.nadaParaRefazer}
          onClick={refazer}
          disabled={!rotulos.refazer}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
        />
      </div>
  );
  const grupoNovo = (
      <GrupoNomeado nome={t.mesa.novo}>
        <div className="barra-grupo" role="group" aria-label={t.mesa.novo}>
          {tiposNovos.map((tipo) => (
            <Ferramenta
              key={tipo}
              data-tipo={tipo}
              icone={ICONES_TIPO[tipo] ?? 'mesaLivre'}
              rotulo={t.mesa.nomeObjeto[tipo]}
              aria-label={t.mesa.novoObjeto(t.mesa.nomeObjeto[tipo])}
              title={t.mesa.novoObjeto(t.mesa.nomeObjeto[tipo])}
              onClick={() => novoObjeto(tipo)}
            />
          ))}
        </div>
      </GrupoNomeado>
  );
  const grupoBases = (
    <div className="barra-grupo" role="group" aria-label={t.mesa.bases.titulo}>
        <Menu
          className="menu-bases"
          icone="tabela"
          texto={t.mesa.bases.botao}
          rotulo={t.mesa.bases.titulo}
          alinhar="inicio"
          itens={[
            ...[...MODELOS, ...BASES].map((b) => ({ rotulo: b.linhas.length === 0 ? `${b.nome} (tabela vazia)` : b.nome, aoEscolher: () => usarBase(b) })),
            { rotulo: t.mesa.bases.importar, aoEscolher: () => entradaCsv.current?.click() },
          ]}
        />
        <input
          ref={entradaCsv}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importarCsv(f);
          }}
        />
    </div>
  );
  const ferramentasMesa = (
    <>
      {grupoHistorico}
      <Separador />
      {grupoBases}
      <Separador />
      {grupoNovo}
    </>
  );
  const ferramentaOrganizar = (
    <Ferramenta icone="organizar" rotulo={t.mesa.organizar} title={t.mesa.organizarAjuda} onClick={organizar} disabled={visiveis.length < 2} />
  );

  return (
    <div className="mesa-raiz">
      {encaixes?.mesa ? (
        <>
          {encaixes.novo ? (
            <>
              <Encaixar encaixe={encaixes.mesa}>{grupoHistorico}<Separador />{grupoBases}</Encaixar>
              <Encaixar encaixe={encaixes.novo}>{grupoNovo}</Encaixar>
            </>
          ) : (
            <Encaixar encaixe={encaixes.mesa}>{ferramentasMesa}</Encaixar>
          )}
          <Encaixar encaixe={encaixes.visao}>{ferramentaOrganizar}</Encaixar>
        </>
      ) : (
        <div className="mesa-barra" role="toolbar" aria-label={t.mesa.barra}>
          {ferramentasMesa}
          <Separador />
          <div className="barra-grupo" ref={setEncaixeLocal} />
          <span className="espaco" />
          {ferramentaOrganizar}
        </div>
      )}
      {aviso && <p className="aviso" role="alert">{aviso}</p>}

      <div ref={mesaRef} id="mesa" tabIndex={-1} className="mesa" role="region" aria-label={t.mesa.nomeDaMesa} onPointerDown={(e) => { if (e.target === e.currentTarget) focarObjeto(null); }}>
        {visiveis.length === 0 && filtroEtapa && (
          <div className="convite-etapa" role="status" data-testid="convite-etapa">
            <strong>{t.ciclo.convite.titulo(t.ciclo.etapas[filtroEtapa])}</strong>
            <span>{t.ciclo.convite.texto}</span>
            <span className="convite-botoes">
              {sugeridosDa(filtroEtapa).filter((x) => !ocultos.includes(x)).map((tipo) => (
                <button key={tipo} type="button" className="convite-card" data-tipo={tipo} onClick={() => novoObjeto(tipo, { reusarColecao: true })}>
                  <Icone nome={ICONES_TIPO[tipo] ?? 'mesaLivre'} />
                  <span>{t.ciclo.convite.criar(t.mesa.nomeObjeto[tipo])}</span>
                </button>
              ))}
            </span>
          </div>
        )}
        {visiveis.map((objeto) => {
          const colecao = colecaoDoObjeto(objeto, projeto.colecoes);
          return (
            <ObjetoNaMesa
              key={objeto.id}
              objeto={objeto}
              colecao={colecao}
              selecao={(colecao && selecaoCasos[colecao.id]) || VAZIO}
              aoSelecionar={aoSelecionarDe(colecao?.id)}
              perfil={perfil}
              ferramentas={limites.ferramentas}
              z={ordem.indexOf(objeto.id) + 1}
              focado={focadoId === objeto.id}
              encaixe={encaixeContextual}
              confirmando={apagando === objeto.id}
              aoFocar={() => focar(objeto.id)}
              aoPedirApagar={() => setApagando(objeto.id)}
              aoCancelarApagar={() => setApagando(null)}
              aoApagar={() => {
                executar(apagarObjeto(objeto.id));
                selarHistorico();
                setApagando(null);
                requestAnimationFrame(() => mesaRef.current?.focus()); // o foco não se perde com a janela apagada
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface PropsObjetoNaMesa {
  objeto: ObjetoMesa;
  colecao: Colecao | undefined;
  selecao: ReadonlySet<Id>;
  aoSelecionar(ids: Id[], modo: ModoSelecaoObjeto): void;
  perfil: PerfilEnsino;
  ferramentas: Readonly<Record<string, boolean>>;
  z: number;
  focado: boolean;
  encaixe: HTMLElement | null;
  confirmando: boolean;
  aoFocar(): void;
  aoPedirApagar(): void;
  aoCancelarApagar(): void;
  aoApagar(): void;
}

function ObjetoNaMesa(p: PropsObjetoNaMesa) {
  const { objeto, colecao } = p;
  const { executar, selarHistorico } = useAcoes();
  const gesto = useRef<GestoAtivo | null>(null);
  const Componente = obterTipoObjeto(objeto.tipo);
  const titulo = tituloDoObjeto(objeto, colecao);
  const botaoNao = useRef<HTMLButtonElement>(null);
  const [editando, setEditando] = useState(false);
  const confirmarNome = (valor: string) => {
    setEditando(false);
    if (valor.trim() !== titulo) { executar(renomearObjeto(objeto.id, valor)); selarHistorico(); }
  };
  const barraRef = useRef<HTMLElement>(null);
  const cancelouNome = useRef(false);
  const eraConfirmando = useRef(false);
  useEffect(() => {
    if (p.confirmando) botaoNao.current?.focus();
    else if (eraConfirmando.current) barraRef.current?.querySelector<HTMLElement>('.menu-botao')?.focus(); // cancelou: o foco volta ao menu
    eraConfirmando.current = p.confirmando;
  }, [p.confirmando]);

  function iniciar(tipo: GestoAtivo['tipo'], e: PointerReact<HTMLElement>) {
    if (e.button !== undefined && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    selarHistorico(); // cada gesto começa um comando novo
    gesto.current = {
      tipo,
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      x0: objeto.x,
      y0: objeto.y,
      l0: objeto.l,
      a0: objeto.a,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function andar(e: PointerReact<HTMLElement>) {
    const g = gesto.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.inicioX;
    const dy = e.clientY - g.inicioY;
    if (g.tipo === 'mover') {
      executar(moverObjeto(objeto.id, Math.max(0, Math.round(g.x0 + dx)), Math.max(0, Math.round(g.y0 + dy))));
    } else {
      executar(redimensionarObjeto(objeto.id, {
        l: Math.max(LARGURA_MINIMA, Math.round(g.l0 + dx)),
        a: Math.max(ALTURA_MINIMA, Math.round(g.a0 + dy)),
      }));
    }
  }

  function terminar(e: PointerReact<HTMLElement>) {
    const g = gesto.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesto.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    selarHistorico();
  }

  function teclado(tipo: GestoAtivo['tipo'], e: KeyboardEvent<HTMLElement>) {
    const passos: Record<string, [number, number]> = {
      ArrowLeft: [-PASSO_TECLADO, 0], ArrowRight: [PASSO_TECLADO, 0], ArrowUp: [0, -PASSO_TECLADO], ArrowDown: [0, PASSO_TECLADO],
    };
    const passo = passos[e.key];
    if (!passo) return;
    e.preventDefault();
    if (tipo === 'mover') {
      executar(moverObjeto(objeto.id, Math.max(0, objeto.x + passo[0]), Math.max(0, objeto.y + passo[1])));
    } else {
      executar(redimensionarObjeto(objeto.id, {
        l: Math.max(LARGURA_MINIMA, objeto.l + passo[0]),
        a: Math.max(ALTURA_MINIMA, objeto.a + passo[1]),
      }));
    }
  }

  const corpo = Componente ? (
    <Componente
      objeto={objeto}
      colecao={colecao}
      selecao={p.selecao}
      aoSelecionar={p.aoSelecionar}
      executar={executar}
      selarHistorico={selarHistorico}
      perfil={p.perfil}
      ferramentas={p.ferramentas}
    />
  ) : (
    <div className="em-breve" role="status">
      <strong>{t.mesa.emBreve}</strong>
      <span>{t.mesa.emBreveExplicacao(t.mesa.nomeObjeto[objeto.tipo])}</span>
    </div>
  );

  return (
    <section
      className={`objeto${p.focado ? ' focado' : ''}`}
      data-objeto={objeto.id}
      data-tipo={objeto.tipo}
      data-etapa={objeto.etapa}
      aria-label={titulo}
      style={{ left: objeto.x, top: objeto.y, width: objeto.l, height: objeto.a, zIndex: p.z }}
      onPointerDownCapture={p.aoFocar}
      onFocusCapture={p.aoFocar}
    >
      <header
        ref={barraRef}
        className="objeto-barra"
        data-testid={`barra-${objeto.id}`}
        tabIndex={0}
        aria-label={t.mesa.mover(titulo)}
        onPointerDown={(e) => iniciar('mover', e)}
        onPointerMove={andar}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button, input, [role=alertdialog]')) setEditando(true); }}
        onKeyDown={(e) => { if (e.target === e.currentTarget) teclado('mover', e); if (e.key === 'F2') setEditando(true); }}
        onKeyUp={(e) => { if (e.target === e.currentTarget && e.key.startsWith('Arrow')) selarHistorico(); }}
      >
        {editando ? (
          <input
            className="objeto-titulo-campo"
            autoFocus
            defaultValue={titulo}
            aria-label={t.mesa.renomear}
            maxLength={60}
            onFocus={(e) => e.currentTarget.select()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { confirmarNome(e.currentTarget.value); barraRef.current?.focus(); }
              else if (e.key === 'Escape') { cancelouNome.current = true; setEditando(false); barraRef.current?.focus(); }
            }}
            onBlur={(e) => { if (cancelouNome.current) cancelouNome.current = false; else confirmarNome(e.currentTarget.value); }}
          />
        ) : (
          <span className="objeto-titulo" title={t.mesa.renomearDica} >{titulo}</span>
        )}
        {p.confirmando ? (
          <span
            className="objeto-confirma"
            role="alertdialog"
            aria-label={t.mesa.confirmarApagar}
            onKeyDown={(e) => { if (e.key === 'Escape') p.aoCancelarApagar(); }}
          >
            <span>{t.mesa.confirmarApagar}</span>
            <button type="button" className="botao-pequeno perigo" onClick={p.aoApagar}>{t.mesa.confirmarSim}</button>
            <button type="button" className="botao-pequeno" ref={botaoNao} onClick={p.aoCancelarApagar}>{t.mesa.confirmarNao}</button>
          </span>
        ) : (
          <Menu
            className="objeto-menu"
            rotulo={t.mesa.opcoesDe(titulo)}
            itens={[{ rotulo: t.mesa.apagarNoMenu, perigo: true, aoEscolher: p.aoPedirApagar }]}
          />
        )}
      </header>
      <div className="objeto-corpo">
        <ContextoObjeto.Provider value={{ focado: p.focado, encaixe: p.encaixe }}>{corpo}</ContextoObjeto.Provider>
      </div>
      <div
        className="objeto-alca"
        role="separator"
        tabIndex={0}
        aria-label={t.mesa.redimensionar(titulo)}
        aria-valuenow={Math.round(objeto.l)}
        aria-valuetext={`${Math.round(objeto.l)} por ${Math.round(objeto.a)}`}
        data-testid={`alca-${objeto.id}`}
        onPointerDown={(e) => iniciar('redimensionar', e)}
        onPointerMove={andar}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onKeyDown={(e) => teclado('redimensionar', e)}
        onKeyUp={(e) => { if (e.key.startsWith('Arrow')) selarHistorico(); }}
      />
    </section>
  );
}
