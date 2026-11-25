import { ferramentaLigada, type FerramentaGrafico } from '../../estado/ferramentas';
import { FORMAS_ICONE, caminhoSvg } from './formas';
import type { LegendaFormas } from './formasPorCategoria';
import { useEffect, useId, useState } from 'react';
import type { Atributo } from '../../modelo/tipos';
import { Icone } from '../../app/icones';
import type { Legenda } from './cores';
import {
  alternarMedida, definirCorPor, definirFormaPor, definirEixo, definirFiltro, definirIcone, definirLarguraIntervalos, definirModo,
  remexer, removerEixo, trocarEixos, TAMANHO_ICONE_MAX, TAMANHO_ICONE_MIN,
  type EstadoGrafico, type FormaIcone, type Medida, type ModoEixo, type QualEixo,
} from './estado';
import { Ferramenta, GrupoNomeado } from '../../app/ui';
import type { NomeIcone } from '../../app/icones';
import { textos } from './textos';
import { t } from '../../i18n/pt-BR';

export interface PropsPainel {
  estado: EstadoGrafico;
  atributos: readonly Atributo[];
  perfil: 'iniciais' | 'finais';
  /** Ajustes do professor por ferramenta (vencem o perfil). */
  ferramentas?: Readonly<Record<string, boolean>>;
  erroFiltro: string | null;
  filtrando: boolean;
  visiveis: number;
  total: number;
  legenda: Legenda | null;
  /** Largura de intervalo realmente usada em cada eixo (a automática, se o usuário não escolheu). */
  larguraEfetiva: { x?: number; y?: number };
  aoMudar(novo: EstadoGrafico, rotulo: string): void;
  aoSelarHistorico(): void;
  aoExportar(): void;
  aoExportarPdf(): void;
  mensagem?: string | null;
}

function ligada(p: PropsPainel, id: FerramentaGrafico): boolean {
  return ferramentaLigada(p.perfil, p.ferramentas, id);
}

function passoDaLargura(v: number): number {
  return v >= 10 ? 1 : v >= 1 ? 0.5 : 0.1;
}

function arredondar(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

const ICONE_MODO: Record<ModoEixo, NomeIcone> = { separar: 'separar', ordenar: 'ordenar', empilhar: 'empilhar', intervalos: 'intervalos' };
const ICONE_MEDIDA: Record<Medida, NomeIcone> = { contagem: 'contagem', porcentagem: 'porcentagem', media: 'media', mediana: 'mediana', moda: 'moda' };

function CampoLargura(props: { valor: number; aoMudar(v: number | undefined): void; automatica: boolean }) {
  const id = useId();
  const [texto, setTexto] = useState(String(props.valor).replace('.', ','));
  useEffect(() => {
    const atual = Number(texto.replace(',', '.'));
    if (atual !== props.valor) setTexto(String(props.valor).replace('.', ','));
    // só sincroniza quando o valor de fora muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.valor]);
  const passo = passoDaLargura(props.valor);
  const confirmar = (t: string) => {
    const n = Number(t.replace(',', '.'));
    if (t.trim() !== '' && Number.isFinite(n) && n > 0) props.aoMudar(n);
  };
  return (
    <div className="grafico-largura">
      <label htmlFor={id}>{textos.larguraDoIntervalo}</label>
      <button type="button" className="botao-pequeno" aria-label={textos.larguraMenos}
        onClick={() => props.aoMudar(Math.max(arredondar(passo), arredondar(props.valor - passo)))}>−</button>
      <input id={id} className="grafico-campo grafico-campo--curto" type="text" inputMode="decimal" value={texto}
        onChange={(e) => { setTexto(e.target.value); confirmar(e.target.value); }} />
      <button type="button" className="botao-pequeno" aria-label={textos.larguraMais}
        onClick={() => props.aoMudar(arredondar(props.valor + passo))}>+</button>
      <button type="button" className="botao-pequeno" aria-pressed={props.automatica}
        onClick={() => props.aoMudar(undefined)}>{textos.larguraAutomatica}</button>
    </div>
  );
}

/** Seletor da variável de um eixo (vai para a faixa fina embaixo do quadro). */
function VariavelDoEixo({ qual, p }: { qual: QualEixo; p: PropsPainel }) {
  const eixo = qual === 'x' ? p.estado.x : p.estado.y;
  const nome = qual === 'x' ? textos.eixoHorizontal : textos.eixoVertical;
  const existe = eixo && p.atributos.some((a) => a.id === eixo.atributoId);
  return (
    <label className="grafico-variavel" data-eixo={qual}>
      <span className="grafico-variavel__nome">{qual === 'x' ? textos.horizontal : textos.vertical}</span>
      <select className="grafico-campo" aria-label={textos.atributoDoEixo(nome)}
        value={existe ? eixo!.atributoId : ''}
        onChange={(e) => {
          const v = e.target.value;
          p.aoMudar(v === '' ? removerEixo(p.estado, qual) : definirEixo(p.estado, qual, v), `Mudar ${nome.toLowerCase()}`);
        }}>
        <option value="">{textos.nenhum}</option>
        {p.atributos.map((a) => (
          <option key={a.id} value={a.id}>{a.nome}</option>
        ))}
      </select>
    </label>
  );
}

/** Separar, Empilhar etc. de um eixo (vai para a barra do topo). */
function ModosDoEixo({ qual, p }: { qual: QualEixo; p: PropsPainel }) {
  const eixo = qual === 'x' ? p.estado.x : p.estado.y;
  const nome = qual === 'x' ? textos.eixoHorizontal : textos.eixoVertical;
  const modos: ModoEixo[] = ['separar', ...(ligada(p, 'ordenar') ? (['ordenar'] as const) : []), 'empilhar', ...(ligada(p, 'intervalos') ? (['intervalos'] as const) : [])];
  const existe = eixo && p.atributos.some((a) => a.id === eixo.atributoId);
  return (
    <GrupoNomeado nome={qual === 'x' ? textos.horizontal : textos.vertical}>
      <div className="barra-grupo" role="group" aria-label={textos.modoDoEixo(nome)} data-eixo={qual}>
        {modos.map((m) => (
          <Ferramenta key={m} icone={ICONE_MODO[m]} rotulo={textos.modos[m]} disabled={!existe}
            ativo={!!existe && eixo!.modo === m}
            onClick={() => p.aoMudar(definirModo(p.estado, qual, m), `${textos.modos[m]} (${nome.toLowerCase()})`)} />
        ))}
      </div>
    </GrupoNomeado>
  );
}

function BotaoMedida(props: { p: PropsPainel; medida: Medida }) {
  const { p, medida } = props;
  return (
    <Ferramenta icone={ICONE_MEDIDA[medida]} rotulo={textos.medida[medida]} ativo={p.estado.mostrar.includes(medida)}
      onClick={() => p.aoMudar(alternarMedida(p.estado, medida), `${textos.medida[medida]}`)} />
  );
}

/** A legenda flutua dentro do quadro do gráfico. */
export function LegendaCores({ legenda }: { legenda: Legenda }) {
  return (
    <div className="grafico-legenda" role="group" aria-label={textos.legenda(legenda.titulo)}>
      <strong className="grafico-legenda__titulo">{legenda.titulo}</strong>
      {legenda.tipo === 'categorica' ? (
        <ul className="grafico-legenda__lista">
          {legenda.itens.map((i) => (
            <li key={i.rotulo}>
              <span className="grafico-legenda__amostra" style={{ background: i.cor }} aria-hidden="true" />
              {i.rotulo}
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <div className="grafico-legenda__gradiente" style={{ background: `linear-gradient(to right, ${legenda.paradas.join(', ')})` }} aria-hidden="true" />
          <div className="grafico-legenda__extremos">
            <span>{legenda.rotuloMinimo}</span>
            <span>{legenda.rotuloMaximo}</span>
          </div>
          {legenda.temSemValor && <div className="grafico-legenda__sem">{textos.semValor}: cinza</div>}
        </div>
      )}
    </div>
  );
}

/** Legenda dos ícones quando cada categoria tem o seu. */
export function LegendaDeFormas({ legenda }: { legenda: LegendaFormas }) {
  return (
    <div className="grafico-legenda" role="group" aria-label={textos.legendaFormas(legenda.titulo)}>
      <strong className="grafico-legenda__titulo">{textos.formaPorCurto}: {legenda.titulo}</strong>
      <ul className="grafico-legenda__lista">
        {legenda.itens.map((i) => (
          <li key={i.rotulo}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={caminhoSvg(i.forma)} fill="currentColor" /></svg>
            {i.rotulo}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ferramentas para a barra do topo: como arrumar cada eixo, o que mostrar e remexer. */
export function BarraDoGrafico(p: PropsPainel) {
  return (
    <>
      <ModosDoEixo qual="x" p={p} />
      <ModosDoEixo qual="y" p={p} />
      {ligada(p, 'trocarEixos') && (
        <Ferramenta icone="trocarEixos" rotulo={textos.trocarEixos} disabled={!p.estado.x && !p.estado.y}
          onClick={() => p.aoMudar(trocarEixos(p.estado), textos.trocarEixos)} />
      )}
      <GrupoNomeado nome={textos.medidasCurto}>
        <div className="barra-grupo" role="group" aria-label={textos.medidas}>
          <BotaoMedida p={p} medida="contagem" />
          {ligada(p, 'porcentagem') && <BotaoMedida p={p} medida="porcentagem" />}
          {ligada(p, 'media') && <BotaoMedida p={p} medida="media" />}
          {ligada(p, 'mediana') && <BotaoMedida p={p} medida="mediana" />}
          {ligada(p, 'moda') && <BotaoMedida p={p} medida="moda" />}
        </div>
      </GrupoNomeado>
      <Ferramenta icone="remexer" rotulo={textos.remexer} title={textos.remexerAjuda}
        onClick={() => p.aoMudar(remexer(p.estado), 'Remexer pontos')} />
      {ligada(p, 'salvarImagem') && <Ferramenta icone="salvarImagem" rotulo={textos.salvarImagem} onClick={p.aoExportar} />}
      {ligada(p, 'exportarPdf') && <Ferramenta icone="exportarPdf" rotulo={t.exportar.pdf} title={t.exportar.pdfDica} onClick={p.aoExportarPdf} />}
    </>
  );
}

/** Faixa fina embaixo do quadro: variáveis dos eixos e, filtro, cor e ícone (conforme o perfil e o professor). */
export function FaixaDoGrafico(p: PropsPainel & { selecionados: string }) {
  const idFiltro = useId();
  const idTamanho = useId();
  const [textoFiltro, setTextoFiltro] = useState(p.estado.filtro ?? '');
  useEffect(() => {
    if ((p.estado.filtro ?? '') !== textoFiltro && (p.estado.filtro ?? '').trim() !== textoFiltro.trim()) setTextoFiltro(p.estado.filtro ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.estado.filtro]);
  const formas: readonly FormaIcone[] = FORMAS_ICONE;
  const formaPorValida = p.estado.icone.formaPor && p.atributos.some((a) => a.id === p.estado.icone.formaPor && a.tipo === 'categorico') ? p.estado.icone.formaPor : '';
  const corValida = p.estado.corPor && p.atributos.some((a) => a.id === p.estado.corPor) ? p.estado.corPor : '';
  const eixoX = p.estado.x && p.atributos.some((a) => a.id === p.estado.x!.atributoId) ? p.estado.x : null;
  const eixoY = p.estado.y && p.atributos.some((a) => a.id === p.estado.y!.atributoId) ? p.estado.y : null;

  return (
    <div className="grafico-faixa-itens">
      <VariavelDoEixo qual="x" p={p} />
      <VariavelDoEixo qual="y" p={p} />
      {ligada(p, 'intervalos') && eixoX?.modo === 'intervalos' && (
        <CampoLargura valor={p.larguraEfetiva.x ?? 1} automatica={eixoX.intervalos?.largura === undefined}
          aoMudar={(v) => p.aoMudar(definirLarguraIntervalos(p.estado, 'x', v), 'Largura do intervalo (eixo horizontal)')} />
      )}
      {ligada(p, 'intervalos') && eixoY?.modo === 'intervalos' && (
        <CampoLargura valor={p.larguraEfetiva.y ?? 1} automatica={eixoY.intervalos?.largura === undefined}
          aoMudar={(v) => p.aoMudar(definirLarguraIntervalos(p.estado, 'y', v), 'Largura do intervalo (eixo vertical)')} />
      )}
      {ligada(p, 'corPor') && (
        <label className="grafico-variavel">
          <span className="grafico-variavel__nome">{textos.corPorCurto}</span>
          <select className="grafico-campo" aria-label={textos.corPor} value={corValida}
            onChange={(e) => p.aoMudar(definirCorPor(p.estado, e.target.value || undefined), 'Mudar cor dos pontos')}>
            <option value="">{textos.semCor}</option>
            {p.atributos.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </label>
      )}
      {ligada(p, 'filtro') && (
        <label className="grafico-variavel grafico-variavel--filtro">
          <span className="grafico-variavel__nome">{textos.filtroCurto}</span>
          <input id={idFiltro} className="grafico-campo" type="text" value={textoFiltro} placeholder={textos.filtroExemplo}
            aria-label={textos.filtro} aria-invalid={p.erroFiltro ? true : undefined}
            aria-describedby={p.erroFiltro ? `${idFiltro}-erro` : undefined}
            onChange={(e) => { setTextoFiltro(e.target.value); p.aoMudar(definirFiltro(p.estado, e.target.value), 'Mudar filtro'); }} />
        </label>
      )}
      {(
        <div className="grafico-variavel grafico-formas" role="group" aria-label={textos.forma}>
          <span className="grafico-variavel__nome" aria-hidden="true">{textos.icone}</span>
          {formas.map((f) => (
            <button key={f} type="button" className="botao-icone grafico-forma" aria-label={textos[f]} title={textos[f]} aria-pressed={p.estado.icone.forma === f}
              onClick={() => p.aoMudar(definirIcone(p.estado, { forma: f }), 'Mudar forma do ícone')}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={caminhoSvg(f)} fill="currentColor" /></svg>
            </button>
          ))}
        </div>
      )}
      {(
        <label className="grafico-variavel">
          <span className="grafico-variavel__nome">{textos.formaPorCurto}</span>
          <select className="grafico-campo" aria-label={textos.formaPor} value={formaPorValida}
            onChange={(e) => p.aoMudar(definirFormaPor(p.estado, e.target.value || undefined), 'Mudar ícones por categoria')}>
            <option value="">{textos.semFormaPor}</option>
            {p.atributos.filter((a) => a.tipo === 'categorico').map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </label>
      )}
      {(
        <label className="grafico-variavel" htmlFor={idTamanho}>
          <span className="grafico-variavel__nome">{textos.tamanho}: {p.estado.icone.tamanho}</span>
          <input id={idTamanho} className="grafico-deslizante" type="range" min={TAMANHO_ICONE_MIN} max={TAMANHO_ICONE_MAX} step={1}
            value={p.estado.icone.tamanho}
            onChange={(e) => p.aoMudar(definirIcone(p.estado, { tamanho: Number(e.target.value) }), 'Mudar tamanho do ícone')}
            onPointerUp={p.aoSelarHistorico} onKeyUp={p.aoSelarHistorico} onBlur={p.aoSelarHistorico} />
        </label>
      )}
      {p.erroFiltro && <p id={`${idFiltro}-erro`} role="alert" className="grafico-nota grafico-nota--erro">{textos.filtroErro(p.erroFiltro)}</p>}
      {p.filtrando && !p.erroFiltro && <p className="grafico-nota">{textos.filtroAtivo(p.visiveis, p.total)}</p>}
      {p.mensagem && <p role="alert" className="grafico-nota grafico-nota--erro">{p.mensagem}</p>}
      <p className="grafico__estado" role="status" aria-live="polite">{p.selecionados}</p>
    </div>
  );
}
