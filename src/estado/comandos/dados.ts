import type { Atributo, Caso, Id, ValorCelula } from '../../modelo/tipos';
import { criarComando, ErroComando, exigirColecao, type Comando } from './base';
import { recalcularCalculados, recalcularTudo } from './recalculo';

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function editarCelula(colecaoId: Id, casoId: Id, atributoId: Id, valor: ValorCelula): Comando {
  return criarComando({
    rotulo: 'Editar célula',
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      const caso = colecao.casos.find((c) => c.id === casoId);
      if (!caso) throw new ErroComando('Não achei esse caso na tabela.');
      if (!colecao.atributos.some((a) => a.id === atributoId)) throw new ErroComando('Não achei esse atributo na tabela.');
      caso.valores[atributoId] = valor;
      recalcularCalculados(p, colecao);
    },
    fusao: {
      chave: `celula:${colecaoId}:${casoId}:${atributoId}`,
      params: valor,
      recriar: (v) => editarCelula(colecaoId, casoId, atributoId, v),
    },
  });
}

export function adicionarCaso(colecaoId: Id, caso: Caso, posicao?: number): Comando {
  return criarComando({
    rotulo: 'Adicionar caso',
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      const novo = structuredClone(caso);
      for (const a of colecao.atributos) if (!(a.id in novo.valores)) novo.valores[a.id] = null;
      colecao.casos.splice(posicao ?? colecao.casos.length, 0, novo);
      recalcularCalculados(p, colecao);
    },
  });
}

export function apagarCasos(colecaoId: Id, casoIds: Id[]): Comando {
  const alvo = new Set(casoIds);
  return criarComando({
    rotulo: casoIds.length === 1 ? 'Apagar caso' : `Apagar ${casoIds.length} casos`,
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      colecao.casos = colecao.casos.filter((c) => !alvo.has(c.id));
      recalcularCalculados(p, colecao);
    },
  });
}

export function adicionarAtributo(colecaoId: Id, atributo: Atributo, posicao?: number): Comando {
  return criarComando({
    rotulo: `Adicionar atributo '${atributo.nome}'`,
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      if (colecao.atributos.some((a) => a.nome.toLowerCase() === atributo.nome.toLowerCase())) {
        throw new ErroComando(`Já existe um atributo chamado '${atributo.nome}'.`);
      }
      colecao.atributos.splice(posicao ?? colecao.atributos.length, 0, structuredClone(atributo));
      for (const caso of colecao.casos) caso.valores[atributo.id] = null;
      recalcularCalculados(p, colecao);
    },
  });
}

export function renomearAtributo(colecaoId: Id, atributoId: Id, nome: string): Comando {
  return criarComando({
    rotulo: `Renomear atributo para '${nome}'`,
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      const atributo = colecao.atributos.find((a) => a.id === atributoId);
      if (!atributo) throw new ErroComando('Não achei esse atributo na tabela.');
      const novo = nome.trim();
      if (novo === '') throw new ErroComando('O nome do atributo não pode ficar vazio.');
      if (colecao.atributos.some((a) => a.id !== atributoId && a.nome.toLowerCase() === novo.toLowerCase())) {
        throw new ErroComando(`Já existe um atributo chamado '${novo}'.`);
      }
      const antigo = new RegExp(`\\[\\s*${escaparRegex(atributo.nome)}\\s*\\]`, 'g');
      const semEspaco = /^[\p{L}_][\p{L}\p{N}_]*$/u.test(atributo.nome) ? new RegExp(`(?<![\\p{L}\\p{N}_\\["'])${escaparRegex(atributo.nome)}(?![\\p{L}\\p{N}_\\]"'(])`, 'gu') : null;
      const destino = /^[\p{L}_][\p{L}\p{N}_]*$/u.test(novo) ? novo : `[${novo}]`;
      for (const outro of colecao.atributos) {
        if (!outro.formula) continue;
        let f = outro.formula.replace(antigo, `[${novo}]`);
        if (semEspaco) f = f.replace(semEspaco, destino);
        outro.formula = f;
      }
      atributo.nome = novo;
      recalcularCalculados(p, colecao);
    },
  });
}

export function apagarAtributo(colecaoId: Id, atributoId: Id): Comando {
  return criarComando({
    rotulo: 'Apagar atributo',
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      const indice = colecao.atributos.findIndex((a) => a.id === atributoId);
      if (indice === -1) throw new ErroComando('Não achei esse atributo na tabela.');
      colecao.atributos.splice(indice, 1);
      for (const caso of colecao.casos) delete caso.valores[atributoId];
      recalcularCalculados(p, colecao);
    },
  });
}

export function definirFormula(colecaoId: Id, atributoId: Id, formula: string | undefined): Comando {
  return criarComando({
    rotulo: formula ? 'Definir fórmula' : 'Remover fórmula',
    receita: (p) => {
      const colecao = exigirColecao(p, colecaoId);
      const atributo = colecao.atributos.find((a) => a.id === atributoId);
      if (!atributo) throw new ErroComando('Não achei esse atributo na tabela.');
      if (formula && formula.trim() !== '') atributo.formula = formula;
      else delete atributo.formula;
      recalcularCalculados(p, colecao);
    },
  });
}

export function definirGlobal(nome: string, valor: number): Comando {
  return criarComando({
    rotulo: `Mudar '${nome}'`,
    receita: (p) => {
      p.globais[nome] = valor;
      recalcularTudo(p);
    },
    fusao: { chave: `global:${nome}`, params: valor, recriar: (v) => definirGlobal(nome, v) },
  });
}

export function ocultarCasos(colecaoId: Id, casoIds: Id[]): Comando {
  const alvo = new Set(casoIds);
  return criarComando({
    rotulo: casoIds.length === 1 ? 'Ocultar caso' : `Ocultar ${casoIds.length} casos`,
    receita: (p) => {
      for (const caso of exigirColecao(p, colecaoId).casos) if (alvo.has(caso.id)) caso.oculto = true;
    },
  });
}

export function mostrarOcultos(colecaoId: Id): Comando {
  return criarComando({
    rotulo: 'Mostrar casos ocultos',
    receita: (p) => {
      for (const caso of exigirColecao(p, colecaoId).casos) delete caso.oculto;
    },
  });
}
