import { produce } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { criarProjeto } from '../modelo/fabrica';
import { salvarProjeto } from '../modelo/esquema';
import type { Id, Projeto } from '../modelo/tipos';
import type { Comando } from './comandos';
import * as hist from './historico';

export type ModoSelecao = 'substituir' | 'somar' | 'alternar';

export interface EstadoApp {
  projeto: Projeto;
  historico: hist.Historico;
  selecaoCasos: Record<Id, Set<Id>>;
  objetoFocado: Id | null;
  executar(comando: Comando): void;
  /** Aplica sem entrar no desfazer/refazer (usado pelo modo professor, que o aluno não pode desfazer). */
  executarSemHistorico(comando: Comando): void;
  desfazer(): void;
  refazer(): void;
  selarHistorico(): void;
  abrir(projeto: Projeto): void;
  selecionarCasos(colecaoId: Id, casoIds: Iterable<Id>, modo?: ModoSelecao): void;
  limparSelecao(colecaoId?: Id): void;
  focarObjeto(id: Id | null): void;
  serializar(): string;
}

function sanear(projeto: Projeto, selecao: Record<Id, Set<Id>>, focado: Id | null) {
  const novaSelecao: Record<Id, Set<Id>> = {};
  for (const colecao of projeto.colecoes) {
    const atual = selecao[colecao.id];
    if (!atual?.size) continue;
    const existentes = new Set(colecao.casos.map((c) => c.id));
    const mantidos = [...atual].filter((id) => existentes.has(id));
    if (mantidos.length) novaSelecao[colecao.id] = new Set(mantidos);
  }
  return {
    selecaoCasos: novaSelecao,
    objetoFocado: focado !== null && projeto.objetos.some((o) => o.id === focado) ? focado : null,
  };
}

export function criarArmazem(projetoInicial: Projeto = criarProjeto()): StoreApi<EstadoApp> {
  return createStore<EstadoApp>((set, get) => ({
    projeto: projetoInicial,
    historico: hist.criarHistorico(),
    selecaoCasos: {},
    objetoFocado: null,

    executar(comando) {
      const { historico, projeto, selecaoCasos, objetoFocado } = get();
      const r = hist.executar(historico, projeto, comando);
      set({ ...r, ...sanear(r.projeto, selecaoCasos, objetoFocado) });
    },
    executarSemHistorico(comando) {
      const { projeto, selecaoCasos, objetoFocado } = get();
      const novo = produce(projeto, (rascunho) => {
        comando.aplicar(rascunho as Projeto);
      });
      set({ projeto: novo, ...sanear(novo, selecaoCasos, objetoFocado) });
    },
    desfazer() {
      const { historico, projeto, selecaoCasos, objetoFocado } = get();
      const r = hist.desfazer(historico, projeto);
      if (r) set({ ...r, ...sanear(r.projeto, selecaoCasos, objetoFocado) });
    },
    refazer() {
      const { historico, projeto, selecaoCasos, objetoFocado } = get();
      const r = hist.refazer(historico, projeto);
      if (r) set({ ...r, ...sanear(r.projeto, selecaoCasos, objetoFocado) });
    },
    selarHistorico() {
      set({ historico: hist.selar(get().historico) });
    },
    abrir(projeto) {
      set({ projeto, historico: hist.criarHistorico(), selecaoCasos: {}, objetoFocado: null });
    },
    selecionarCasos(colecaoId, casoIds, modo = 'substituir') {
      const ids = [...casoIds];
      const atual = get().selecaoCasos[colecaoId] ?? new Set<Id>();
      let novo: Set<Id>;
      if (modo === 'substituir') novo = new Set(ids);
      else if (modo === 'somar') novo = new Set([...atual, ...ids]);
      else {
        novo = new Set(atual);
        for (const id of ids) {
          if (!novo.delete(id)) novo.add(id);
        }
      }
      set({ selecaoCasos: { ...get().selecaoCasos, [colecaoId]: novo } });
    },
    limparSelecao(colecaoId) {
      if (colecaoId === undefined) return set({ selecaoCasos: {} });
      const { [colecaoId]: _removida, ...resto } = get().selecaoCasos;
      set({ selecaoCasos: resto });
    },
    focarObjeto(id) {
      set({ objetoFocado: id });
    },
    serializar() {
      return salvarProjeto(get().projeto);
    },
  }));
}
