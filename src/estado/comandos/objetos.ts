import type { EtapaCiclo, Id, ObjetoMesa, TipoObjeto } from '../../modelo/tipos';
import { criarComando, exigirObjeto, type Comando } from './base';

const NOMES_DE_OBJETO: Record<TipoObjeto, string> = {
  tabela: 'tabela', fichas: 'fichas', grafico: 'gráfico', simulador: 'simulador', texto: 'texto', imagem: 'imagem', controle: 'controle',
};

const NOMES_DE_ETAPA: Record<EtapaCiclo, string> = {
  problema: 'Problema', plano: 'Plano', dados: 'Dados', analise: 'Análise', conclusao: 'Conclusão',
};

export function criarObjeto(objeto: ObjetoMesa): Comando {
  return criarComando({
    rotulo: `Criar ${NOMES_DE_OBJETO[objeto.tipo]}`,
    receita: (p) => {
      p.objetos.push(structuredClone(objeto));
    },
  });
}

export function moverObjeto(id: Id, x: number, y: number): Comando {
  return criarComando({
    rotulo: 'Mover objeto',
    receita: (p) => {
      const o = exigirObjeto(p, id);
      o.x = x;
      o.y = y;
    },
    fusao: { chave: `mover:${id}`, params: { x, y }, recriar: (q) => moverObjeto(id, q.x, q.y) },
  });
}

export interface Retangulo {
  x?: number;
  y?: number;
  l: number;
  a: number;
}

export function redimensionarObjeto(id: Id, area: Retangulo): Comando {
  return criarComando({
    rotulo: 'Redimensionar objeto',
    receita: (p) => {
      const o = exigirObjeto(p, id);
      if (area.x !== undefined) o.x = area.x;
      if (area.y !== undefined) o.y = area.y;
      o.l = area.l;
      o.a = area.a;
    },
    fusao: { chave: `redimensionar:${id}`, params: area, recriar: (q) => redimensionarObjeto(id, q) },
  });
}

export function renomearObjeto(id: Id, titulo: string): Comando {
  return criarComando({
    rotulo: 'Renomear objeto',
    receita: (p) => {
      const o = exigirObjeto(p, id);
      const limpo = titulo.trim();
      if (limpo) o.titulo = limpo;
      else delete o.titulo;
    },
  });
}

export function apagarObjeto(id: Id): Comando {
  return criarComando({
    rotulo: 'Apagar objeto',
    receita: (p) => {
      const o = exigirObjeto(p, id);
      p.objetos.splice(p.objetos.indexOf(o), 1);
    },
  });
}

export function mudarEstadoObjeto(id: Id, estado: unknown, rotulo = 'Alterar objeto'): Comando {
  return criarComando({
    rotulo,
    receita: (p) => {
      exigirObjeto(p, id).estado = structuredClone(estado);
    },
    fusao: { chave: `estado:${id}:${rotulo}`, params: estado, recriar: (e) => mudarEstadoObjeto(id, e, rotulo) },
  });
}

export function mudarEtapa(etapa: EtapaCiclo): Comando {
  return criarComando({
    rotulo: `Mudar para a etapa ${NOMES_DE_ETAPA[etapa]}`,
    receita: (p) => {
      p.cicloAtual = etapa;
    },
  });
}
