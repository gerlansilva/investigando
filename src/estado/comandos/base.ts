import { current, enablePatches, isDraft, produceWithPatches, type Patch } from 'immer';
import type { Colecao, Id, ObjetoMesa, Projeto } from '../../modelo/tipos';

enablePatches();

export interface Comando {
  rotulo: string;
  aplicar(p: Projeto): void;
  reverter(p: Projeto): void;
  fundirCom?(outro: Comando): Comando | null;
}

export class ErroComando extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroComando';
  }
}

interface Fusao<P> {
  chave: string;
  params: P;
  recriar: (params: P) => Comando;
}

const fusoes = new WeakMap<Comando, { chave: string; params: unknown }>();

function aplicarPatchesNoLugar(alvo: unknown, patches: readonly Patch[]): void {
  for (const patch of patches) {
    const { path: caminho } = patch;
    let pai = alvo as Record<string | number, unknown>;
    for (let i = 0; i < caminho.length - 1; i++) pai = pai[caminho[i]!] as Record<string | number, unknown>;
    const chave = caminho[caminho.length - 1]!;
    if (patch.op === 'remove') {
      if (Array.isArray(pai)) pai.splice(Number(chave), 1);
      else delete pai[chave];
    } else {
      pai[chave] = structuredClone(patch.value);
    }
  }
}

function instantaneo(p: Projeto): Projeto {
  return isDraft(p) ? current(p) : structuredClone(p);
}

export function criarComando<P = undefined>(def: {
  rotulo: string;
  receita: (p: Projeto) => void;
  fusao?: Fusao<P>;
}): Comando {
  let inversos: Patch[] = [];
  const comando: Comando = {
    rotulo: def.rotulo,
    aplicar(p) {
      const [, patches, inv] = produceWithPatches(instantaneo(p), (rascunho) => {
        def.receita(rascunho as Projeto);
      });
      inversos = inv;
      aplicarPatchesNoLugar(p, patches);
    },
    reverter(p) {
      aplicarPatchesNoLugar(p, inversos);
    },
  };
  const { fusao } = def;
  if (fusao) {
    fusoes.set(comando, { chave: fusao.chave, params: fusao.params });
    comando.fundirCom = (outro) => {
      const meta = fusoes.get(outro);
      return meta && meta.chave === fusao.chave ? fusao.recriar(meta.params as P) : null;
    };
  }
  return comando;
}

export function exigirColecao(p: Projeto, id: Id): Colecao {
  const colecao = p.colecoes.find((c) => c.id === id);
  if (!colecao) throw new ErroComando('Não achei essa coleção no projeto.');
  return colecao;
}

export function exigirObjeto(p: Projeto, id: Id): ObjetoMesa {
  const objeto = p.objetos.find((o) => o.id === id);
  if (!objeto) throw new ErroComando('Não achei esse objeto na mesa.');
  return objeto;
}
