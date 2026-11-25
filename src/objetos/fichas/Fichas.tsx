import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Atributo, Caso, Id } from '../../modelo/tipos';
import { editarCelula } from '../../estado/comandos';
import type { PropsObjeto } from '../../app/tiposObjeto';
import { converterEntrada, eCalculado, formatarValor, tituloAtributo } from '../../app/valoresCelula';
import { t } from '../../i18n/pt-BR';
import './Fichas.css';

export interface EstadoFichas {
  colecaoId: Id;
}

const LARGURA_FICHA = 220;

function CampoFicha(props: {
  atributo: Atributo;
  caso: Caso;
  numero: number;
  aoConfirmar(valor: string): string | null;
}) {
  const { atributo, caso } = props;
  const textoAtual = formatarValor(caso.valores[atributo.id], atributo);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const valorMostrado = rascunho ?? textoAtual;

  function terminar() {
    if (rascunho === null) return;
    if (rascunho === textoAtual) {
      setRascunho(null);
      setErro(null);
      return;
    }
    const mensagem = props.aoConfirmar(rascunho);
    if (mensagem) setErro(mensagem);
    else {
      setRascunho(null);
      setErro(null);
    }
  }

  return (
    <label className="ficha-campo" role="gridcell">
      <span className="ficha-rotulo">
        <span className="ficha-amostra" style={{ background: atributo.cor }} aria-hidden="true" />
        <span className="ficha-nome">{tituloAtributo(atributo)}</span>
      </span>
      <input
        className="ficha-valor"
        aria-label={t.fichas.campo(atributo.nome, props.numero)}
        tabIndex={-1}
        aria-invalid={erro ? true : undefined}
        readOnly={eCalculado(atributo)}
        value={valorMostrado}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={terminar}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const campos = Array.from(e.currentTarget.closest('[role="row"]')?.querySelectorAll<HTMLInputElement>('input') ?? []);
            const proximo = campos[campos.indexOf(e.currentTarget) + (e.shiftKey ? -1 : 1)];
            if (proximo) {
              e.preventDefault();
              terminar();
              proximo.focus();
            }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            terminar();
            (e.currentTarget.closest('[role="row"]') as HTMLElement | null)?.focus();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setRascunho(null);
            setErro(null);
            (e.currentTarget.closest('[role="row"]') as HTMLElement | null)?.focus();
          }
        }}
      />
      {erro && <span className="ficha-erro" role="alert">{erro}</span>}
    </label>
  );
}

export function Fichas({ colecao, selecao, aoSelecionar, executar, selarHistorico }: PropsObjeto<EstadoFichas>) {
  const [foco, setFoco] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [colunas, setColunas] = useState(1);
  const gradeRef = useRef<HTMLDivElement>(null);
  const ancoraRef = useRef(0);
  const focoPendente = useRef(false);
  const visiveis = useMemo(() => (colecao ? colecao.casos.filter((c) => !c.oculto) : []), [colecao]);
  const indiceNaColecao = useMemo(() => {
    const mapa = new Map<Id, number>();
    colecao?.casos.forEach((c, i) => mapa.set(c.id, i));
    return mapa;
  }, [colecao]);

  useEffect(() => {
    const el = gradeRef.current;
    if (!el) return;
    const medir = () => setColunas(Math.max(1, Math.floor(el.clientWidth / LARGURA_FICHA)));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Seleção feita em outro objeto (por exemplo na tabela): leva a ficha selecionada para a vista.
  useEffect(() => {
    const primeiro = visiveis.findIndex((c) => selecao.has(c.id));
    if (primeiro === -1) return;
    const el = gradeRef.current?.querySelector<HTMLElement>(`[data-indice="${primeiro}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [selecao, visiveis]);

  useEffect(() => {
    if (!focoPendente.current) return;
    const el = gradeRef.current?.querySelector<HTMLElement>(`[data-indice="${foco}"]`);
    if (el) {
      el.focus({ preventScroll: false });
      focoPendente.current = false;
    }
  }, [foco]);

  if (!colecao) return <div className="fichas fichas-vazio">{t.fichas.semColecao}</div>;
  if (!visiveis.length) return <div className="fichas fichas-vazio">{t.fichas.semFichas}</div>;

  function selecionar(i: number, e: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>) {
    const caso = visiveis[i];
    if (!caso) return;
    if (e.shiftKey) {
      const de = Math.min(ancoraRef.current, i);
      const ate = Math.max(ancoraRef.current, i);
      aoSelecionar(visiveis.slice(de, ate + 1).map((c) => c.id), 'substituir');
    } else if (e.ctrlKey || e.metaKey) {
      ancoraRef.current = i;
      aoSelecionar([caso.id], 'alternar');
    } else {
      ancoraRef.current = i;
      aoSelecionar([caso.id], 'substituir');
    }
  }

  function mover(para: number, e: KeyboardEvent) {
    const destino = Math.min(Math.max(para, 0), visiveis.length - 1);
    focoPendente.current = true;
    setFoco(destino);
    if (e.shiftKey) selecionar(destino, { shiftKey: true, ctrlKey: false, metaKey: false });
    else selecionar(destino, { shiftKey: false, ctrlKey: false, metaKey: false });
  }

  function aoTeclarFicha(e: KeyboardEvent<HTMLElement>, i: number) {
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); mover(i + 1, e); break;
      case 'ArrowLeft': e.preventDefault(); mover(i - 1, e); break;
      case 'ArrowDown': e.preventDefault(); mover(i + colunas, e); break;
      case 'ArrowUp': e.preventDefault(); mover(i - colunas, e); break;
      case 'Home': e.preventDefault(); mover(0, e); break;
      case 'End': e.preventDefault(); mover(visiveis.length - 1, e); break;
      case ' ': {
        e.preventDefault();
        const caso = visiveis[i];
        if (caso) aoSelecionar([caso.id], 'alternar');
        break;
      }
      case 'Enter':
      case 'F2': {
        e.preventDefault();
        e.currentTarget.querySelector<HTMLInputElement>('input:not([readonly])')?.focus();
        break;
      }
      case 'Escape': aoSelecionar([], 'limpar'); break;
    }
  }

  function confirmarValor(caso: Caso, atributo: Atributo, texto: string): string | null {
    if (!colecao) return null;
    const r = converterEntrada(atributo, texto);
    if (!r.ok) return r.mensagem;
    try {
      executar(editarCelula(colecao.id, caso.id, atributo.id, r.valor));
      selarHistorico();
      setAviso(null);
      return null;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : t.mesa.erroGenerico;
      setAviso(mensagem);
      return mensagem;
    }
  }

  const foco2 = Math.min(foco, visiveis.length - 1);

  return (
    <div className="fichas">
      <div
        className="fichas-grade"
        ref={gradeRef}
        role="grid"
        aria-multiselectable="true"
        aria-label={t.fichas.area}
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${LARGURA_FICHA - 20}px, 1fr))` }}
      >
        {visiveis.map((caso, i) => {
          const marcada = selecao.has(caso.id);
          const numero = (indiceNaColecao.get(caso.id) ?? i) + 1;
          return (
            <div
              key={caso.id}
              role="row"
              aria-selected={marcada}
              aria-label={t.fichas.ficha(numero)}
              data-caso={caso.id}
              data-indice={i}
              tabIndex={i === foco2 ? 0 : -1}
              className={marcada ? 'ficha selecionada' : 'ficha'}
              onClick={(e) => selecionar(i, e)}
              onFocus={() => setFoco(i)}
              onKeyDown={(e) => aoTeclarFicha(e, i)}
            >
              <div className="ficha-numero" aria-hidden="true">{numero}</div>
              {colecao.atributos.map((a) => (
                <CampoFicha key={a.id} atributo={a} caso={caso} numero={numero} aoConfirmar={(v) => confirmarValor(caso, a, v)} />
              ))}
            </div>
          );
        })}
      </div>
      {aviso && <p className="aviso" role="alert">{aviso}</p>}
    </div>
  );
}
