import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PointerEventReact } from 'react';
import type { PropsObjeto } from '../../app/tiposObjeto';
import { mudarEstadoObjeto } from '../../estado/comandos';
import { definirIntervalos } from '../../grafico/algoritmos/intervalos';
import { DURACAO_PADRAO_MS, deveAnimar, origemParaNovaLista, passoAnimacao, progresso } from './animacao';
import { construirCena, type Primitiva } from './cena';
import { calcularCores } from './cores';
import { desenharPontos } from './desenho';
import { exportarPng } from './exportar';
import { obterArquivos } from '../../app/arquivos';
import { t } from '../../i18n/pt-BR';
import type { EstadoGrafico } from './estado';
import { lerEstado } from './estado';
import { acharEmRetangulo, acharPonto, construirGrade } from './grade';
import { areaInterna, calcularMargem, calcularNuvem, prepararLayout } from './layout';
import { BarraDoGrafico, FaixaDoGrafico, LegendaCores } from './PainelControle';
import { Ferramentas, useObjetoNaMesa } from '../../app/contextoBarra';
import { textos } from './textos';
import './Grafico.css';

/** Sem painel lateral: o desenho ocupa o quadro inteiro. */
export const LARGURA_PAINEL = 0;
const LIMITE_ARRASTE = 4;

interface AnimacaoPontos {
  ids: string[];
  atual: Float32Array;
  origem: Float32Array;
  alvo: Float32Array;
  inicio: number;
  duracao: number;
  raf: number;
  chave: string;
  colecao: unknown;
  layout: unknown;
  fim: boolean;
}

export function movimentoReduzido(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function chaveDeConfig(e: EstadoGrafico): string {
  return JSON.stringify([e.colecaoId, e.x, e.y, e.icone.tamanho, e.filtro ?? '', e.semente]);
}

function ElementoVetorial({ p }: { p: Primitiva }) {
  if (p.tipo === 'linha') {
    return (
      <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.cor} strokeWidth={p.largura}
        strokeDasharray={p.tracejado?.join(' ')} data-papel={p.papel} />
    );
  }
  if (p.tipo === 'retangulo') {
    return <rect x={p.x} y={p.y} width={p.l} height={p.a} fill={p.preenchimento} stroke={p.contorno} data-papel={p.papel} />;
  }
  return (
    <text x={p.x} y={p.y} textAnchor={p.ancora} fontSize={p.tamanho} fill={p.cor} fontWeight={p.negrito ? 700 : 400}
      transform={p.rotacao ? `rotate(${p.rotacao} ${p.x} ${p.y})` : undefined}
      style={p.halo ? { stroke: 'var(--cor-fundo)' } : undefined} strokeWidth={p.halo ? 4 : undefined}
      strokeLinejoin="round" paintOrder={p.halo ? 'stroke' : undefined} data-papel={p.papel}>
      {p.titulo && <title>{p.titulo}</title>}
      {p.texto}
    </text>
  );
}

export function Grafico(props: PropsObjeto<unknown>) {
  const { objeto, colecao, selecao, aoSelecionar, executar, selarHistorico, perfil } = props;
  const naMesa = useObjetoNaMesa() !== null;
  const estado = useMemo(() => lerEstado(objeto.estado, colecao?.id ?? ''), [objeto.estado, colecao?.id]);

  const mudar = useCallback(
    (novo: EstadoGrafico, rotulo: string) => executar(mudarEstadoObjeto(objeto.id, novo, rotulo)),
    [executar, objeto.id],
  );

  // ---- tamanho ----
  const regiaoRef = useRef<HTMLDivElement>(null);
  const [medido, setMedido] = useState<{ l: number; a: number } | null>(null);
  useLayoutEffect(() => {
    const el = regiaoRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ler = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setMedido((m) => (m && m.l === Math.round(r.width) && m.a === Math.round(r.height) ? m : { l: Math.round(r.width), a: Math.round(r.height) }));
    };
    ler();
    const ro = new ResizeObserver(ler);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tam = medido ?? { l: Math.max(200, objeto.l - LARGURA_PAINEL), a: Math.max(160, objeto.a) };

  // ---- layout, cena e cores ----
  const margem = useMemo(() => calcularMargem(estado, colecao), [estado, colecao]);
  const area = useMemo(() => areaInterna(tam.l, tam.a, margem), [tam.l, tam.a, margem]);
  const layout = useMemo(
    () => prepararLayout({ estado, colecao, largura: area.largura, altura: area.altura }),
    [estado, colecao, area.largura, area.altura],
  );
  const cena = useMemo(() => construirCena(layout, estado, margem), [layout, estado, margem]);
  const { cores, legenda } = useMemo(() => calcularCores(colecao, layout.casos, estado.corPor), [colecao, layout.casos, estado.corPor]);
  const indicesSelecionados = useMemo(() => {
    const s = new Set<number>();
    layout.ids.forEach((id, i) => selecao.has(id) && s.add(i));
    return s;
  }, [layout.ids, selecao]);

  const larguraEfetiva = useMemo(() => {
    const f = (r: typeof layout.x, usuario: number | undefined) =>
      r.numeros && r.cfg.modo === 'intervalos' ? definirIntervalos(r.numeros, { largura: usuario }).largura : undefined;
    return { x: f(layout.x, estado.x?.intervalos?.largura), y: f(layout.y, estado.y?.intervalos?.largura) };
  }, [layout, estado.x, estado.y]);

  // ---- canvas e animação ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anim = useRef<AnimacaoPontos | null>(null);
  const ultimo = useRef({ cores, diametro: layout.diametro, forma: estado.icone.forma, indicesSelecionados, largura: area.largura, altura: area.altura });
  useLayoutEffect(() => {
    ultimo.current = { cores, diametro: layout.diametro, forma: estado.icone.forma, indicesSelecionados, largura: area.largura, altura: area.altura };
  });

  const desenhar = useCallback(() => {
    const canvas = canvasRef.current;
    const a = anim.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const u = ultimo.current;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, u.largura, u.altura);
    if (!a) return;
    desenharPontos(ctx, { posicoes: a.atual, n: a.ids.length, cores: u.cores, diametro: u.diametro, forma: u.forma, selecionados: u.indicesSelecionados });
  }, []);

  // Tamanho do bitmap: dimensões CSS × devicePixelRatio (nitidez em telas retina).
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = Math.round(area.largura * dpr);
    canvas.height = Math.round(area.altura * dpr);
    desenhar();
  }, [area.largura, area.altura, desenhar]);

  // Muda a configuração: anima dos pontos atuais para as novas posições-alvo.
  useEffect(() => {
    const anterior = anim.current;
    if (anterior?.raf) cancelAnimationFrame(anterior.raf);
    const iniciarLaco = (nova: AnimacaoPontos) => {
      const tique = (agora: number) => {
        if (anim.current !== nova) return;
        if (nova.inicio < 0) nova.inicio = agora;
        nova.fim = passoAnimacao(nova.origem, nova.alvo, nova.atual, progresso(agora - nova.inicio, nova.duracao));
        desenhar();
        // O laço só roda enquanto há movimento.
        nova.raf = nova.fim ? 0 : requestAnimationFrame(tique);
      };
      nova.raf = requestAnimationFrame(tique);
      return () => {
        if (nova.raf) cancelAnimationFrame(nova.raf);
        nova.raf = 0;
      };
    };
    // Mesmo layout de antes (ex.: o React remontou o efeito): só retoma o que estava em andamento.
    if (anterior && anterior.layout === layout) {
      anterior.raf = 0;
      return anterior.fim ? undefined : iniciarLaco(anterior);
    }
    const chave = chaveDeConfig(estado);
    const ids = layout.ids;
    const alvo = layout.alvo;
    let origem: Float32Array;
    if (!anterior) {
      origem = layout.nuvem ? alvo : calcularNuvem(colecao, ids, area.largura, area.altura, estado.semente, estado.icone.tamanho);
    } else {
      origem = origemParaNovaLista(anterior.ids, anterior.atual, ids, alvo);
    }
    const soTamanho = !!anterior && anterior.chave === chave && anterior.colecao === colecao;
    const animar = deveAnimar(ids.length, movimentoReduzido()) && !soTamanho;
    const nova: AnimacaoPontos = {
      ids, alvo, origem, atual: animar ? origem.slice() : alvo.slice(),
      inicio: -1, duracao: DURACAO_PADRAO_MS, raf: 0, chave, colecao, layout, fim: !animar,
    };
    anim.current = nova;
    if (!animar) {
      desenhar();
      return;
    }
    return iniciarLaco(nova);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Seleção, cores e ícone mudam sem mover os pontos: só redesenha.
  useEffect(() => {
    desenhar();
  }, [indicesSelecionados, cores, layout.diametro, estado.icone.forma, desenhar]);

  // ---- interação ----
  const interacaoRef = useRef<HTMLDivElement>(null);
  const inicioArraste = useRef<{ x: number; y: number; alternar: boolean } | null>(null);
  const [laco, setLaco] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = interacaoRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const gradeAtual = () => {
    const a = anim.current;
    return a ? construirGrade(a.atual, a.ids.length, area.largura, area.altura) : null;
  };

  const aoPressionar = (e: PointerEventReact<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const p = local(e);
    inicioArraste.current = { x: p.x, y: p.y, alternar: e.shiftKey || e.metaKey || e.ctrlKey };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const [dica, setDica] = useState<{ x: number; y: number; linhas: string[] } | null>(null);
  const mostrarDica = (x: number, y: number) => {
    const grade = gradeAtual();
    const r = layout.diametro / 2;
    const i = grade ? acharPonto(grade, x, y, r + 3) : -1;
    const caso = i >= 0 ? layout.casos[i] : undefined;
    if (!caso || !colecao) { setDica(null); return; }
    const linhas = colecao.atributos
      .map((a) => [a.nome, caso.valores[a.id]] as const)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 5)
      .map(([n, v]) => `${n}: ${typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v)}`);
    setDica({ x, y, linhas });
  };
  const aoMover = (e: PointerEventReact<HTMLDivElement>) => {
    const ini = inicioArraste.current;
    if (!ini) { const q = local(e); mostrarDica(q.x, q.y); return; }
    if (dica) setDica(null);
    const p = local(e);
    if (laco || Math.hypot(p.x - ini.x, p.y - ini.y) >= LIMITE_ARRASTE) setLaco({ x0: ini.x, y0: ini.y, x1: p.x, y1: p.y });
  };
  const aoSoltar = (e: PointerEventReact<HTMLDivElement>) => {
    const ini = inicioArraste.current;
    inicioArraste.current = null;
    if (!ini) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const p = local(e);
    const grade = gradeAtual();
    const idsDe = (indices: number[]) => indices.map((i) => layout.ids[i]!);
    if (Math.hypot(p.x - ini.x, p.y - ini.y) >= LIMITE_ARRASTE || laco) {
      setLaco(null);
      const achados = grade ? idsDe(acharEmRetangulo(grade, ini.x, ini.y, p.x, p.y)) : [];
      if (ini.alternar) aoSelecionar(achados, 'alternar');
      else if (achados.length > 0) aoSelecionar(achados, 'substituir');
      else aoSelecionar([], 'limpar');
      return;
    }
    const r = layout.diametro / 2;
    let i = grade ? acharPonto(grade, p.x, p.y, r + 1) : -1;
    if (i < 0 && grade) i = acharPonto(grade, p.x, p.y, Math.max(r + 6, 14));
    if (i >= 0) aoSelecionar([layout.ids[i]!], ini.alternar ? 'alternar' : 'substituir');
    else if (!ini.alternar) aoSelecionar([], 'limpar');
  };
  const aoCancelar = () => {
    inicioArraste.current = null;
    setLaco(null);
  };
  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') aoSelecionar([], 'limpar');
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      aoSelecionar([...layout.ids], 'substituir');
    }
  };

  // ---- exportação ----
  const [mensagem, setMensagem] = useState<string | null>(null);
  const exportar = useCallback((como: 'png' | 'pdf') => {
    setMensagem(null);
    const nomeBase = textos.nomeArquivoPng.replace(/\.png$/, '');
    exportarPng(estado, colecao, { largura: tam.l, altura: tam.a, selecao })
      .then(async (blob) => {
        if (como === 'png') await obterArquivos().exportarPng(blob, nomeBase);
        else await obterArquivos().exportarPdf(blob, textos.nomeDoObjeto);
      })
      .catch((err: unknown) => setMensagem(err instanceof Error ? err.message : t.exportar.erro));
  }, [estado, colecao, tam.l, tam.a, selecao]);

  if (!colecao) {
    return (
      <div className="grafico grafico--vazio" role="status" aria-label={textos.semColecaoAria}>
        <p>{textos.semColecao}</p>
      </div>
    );
  }

  const retanguloLaco = laco && {
    left: Math.min(laco.x0, laco.x1), top: Math.min(laco.y0, laco.y1),
    width: Math.abs(laco.x1 - laco.x0), height: Math.abs(laco.y1 - laco.y0),
  };

  const propsControles = {
    estado,
    atributos: colecao.atributos,
    perfil,
    erroFiltro: layout.erroFiltro,
    filtrando: layout.filtrando,
    visiveis: layout.ids.length,
    total: layout.totalCasos,
    legenda,
    larguraEfetiva,
    aoMudar: mudar,
    aoSelarHistorico: selarHistorico,
    aoExportar: () => exportar('png'),
    aoExportarPdf: () => exportar('pdf'),
    mensagem,
  };
  const selecionados = textos.selecionados(indicesSelecionados.size);

  return (
    <div className="grafico" data-perfil={perfil}>
      <Ferramentas rotulo={textos.painel} complementar={!naMesa}>
        <BarraDoGrafico {...propsControles} />
        {!naMesa && <FaixaDoGrafico {...propsControles} selecionados={selecionados} />}
      </Ferramentas>
      {legenda && <LegendaCores legenda={legenda} />}
      <div className="grafico__regiao" ref={regiaoRef}>
        <div className="grafico__quadro" style={{ width: tam.l, height: tam.a }}>
          <canvas ref={canvasRef} className="grafico__canvas" aria-hidden="true"
            style={{ left: margem.esq, top: margem.sup, width: area.largura, height: area.altura }} />
          <svg className="grafico__svg" width={tam.l} height={tam.a} role="img" aria-label={textos.ariaGrafico(layout.ids.length)} data-testid="grafico-svg">
            <g transform={`translate(${margem.esq} ${margem.sup})`}>
              {cena.map((p, i) => (
                <ElementoVetorial key={i} p={p} />
              ))}
            </g>
          </svg>
          <div ref={interacaoRef} className="grafico__interacao" tabIndex={0} role="group" aria-label={textos.areaDoGrafico}
            data-testid="grafico-interacao"
            style={{ left: margem.esq, top: margem.sup, width: area.largura, height: area.altura }}
            onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoCancelar} onPointerLeave={() => setDica(null)} onKeyDown={aoTeclar}>
            {dica && (
              <div className="grafico__dica" role="tooltip" style={{ left: Math.min(dica.x + 12, Math.max(0, area.largura - 150)), top: Math.max(0, dica.y - 12 - dica.linhas.length * 18) }}>
                {dica.linhas.map((l) => <div key={l}>{l}</div>)}
              </div>
            )}
            {retanguloLaco && <div className="grafico__laco" aria-hidden="true" data-testid="grafico-laco" style={retanguloLaco} />}
          </div>
        </div>
      </div>
      {naMesa && (
        <div className="grafico-faixa" role="group" aria-label={textos.painel}>
          <FaixaDoGrafico {...propsControles} selecionados={selecionados} />
        </div>
      )}
    </div>
  );
}
