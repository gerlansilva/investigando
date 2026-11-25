import type { Atributo, Caso, Colecao, Id, Projeto } from '../../modelo/tipos';
import { ErroSimulador } from '../../simulador/erro';
import { validarRegistroEstatistica, type RegistroEstatistica } from '../../simulador/historico';
import { criarComando, ErroComando, exigirObjeto, type Comando } from './base';
import { recalcularCalculados } from './recalculo';

export interface LoteColecao {
  id: Id;
  nome: string;
  /** Atributos que a coleção deve ter; os que faltarem são criados. */
  atributos: Atributo[];
  /** Casos a acrescentar. Casos cujo id já existe na coleção são ignorados (o comando pode ser refeito com mais casos). */
  casos: Caso[];
}

export interface ParamsLoteSimulador {
  objetoId: Id;
  /** Identifica a execução; comandos seguidos da mesma execução se fundem num só passo do desfazer. */
  execucaoId: string;
  resultados?: LoteColecao;
  estatisticas?: LoteColecao;
  registro?: RegistroEstatistica;
  semente?: number;
  rodada?: number;
  rotulo?: string;
}

function garantirColecao(p: Projeto, lote: LoteColecao): Colecao {
  let colecao = p.colecoes.find((c) => c.id === lote.id);
  if (!colecao) {
    p.colecoes.push({ id: lote.id, nome: lote.nome, atributos: [], casos: [] });
    colecao = p.colecoes[p.colecoes.length - 1]!;
  }
  for (const a of lote.atributos) {
    if (colecao.atributos.some((x) => x.id === a.id)) continue;
    if (colecao.atributos.some((x) => x.nome.toLowerCase() === a.nome.toLowerCase())) {
      throw new ErroComando(`Já existe um atributo chamado '${a.nome}' na coleção '${colecao.nome}'.`);
    }
    colecao.atributos.push(structuredClone(a));
    for (const caso of colecao.casos) caso.valores[a.id] = null;
  }
  const existentes = new Set(colecao.casos.map((c) => c.id));
  const conhecidos = colecao.atributos.map((a) => a.id);
  for (const caso of lote.casos) {
    if (existentes.has(caso.id)) continue;
    const novo = structuredClone(caso);
    for (const id of conhecidos) if (!(id in novo.valores)) novo.valores[id] = null;
    colecao.casos.push(novo);
  }
  recalcularCalculados(p, colecao);
  return colecao;
}

function estadoComoObjeto(estado: unknown): Record<string, unknown> {
  return typeof estado === 'object' && estado !== null && !Array.isArray(estado) ? { ...(estado as Record<string, unknown>) } : {};
}

/**
 * Registra o resultado de uma execução do simulador num único passo desfazível: cria as coleções ligadas ao
 * objeto (se ainda não existirem), acrescenta os casos, guarda o registro de estatística e atualiza semente/rodada.
 */
export function registrarLoteSimulador(params: ParamsLoteSimulador): Comando {
  let registro: RegistroEstatistica | undefined;
  if (params.registro) {
    try {
      registro = validarRegistroEstatistica(params.registro);
    } catch (e) {
      if (e instanceof ErroSimulador) throw new ErroComando(e.message);
      throw e;
    }
  }
  const total = (params.resultados?.casos.length ?? 0) + (params.estatisticas?.casos.length ?? 0);
  return criarComando({
    rotulo: params.rotulo ?? (total === 1 ? 'Sortear no simulador' : `Sortear no simulador (${total} casos)`),
    receita: (p) => {
      const objeto = exigirObjeto(p, params.objetoId);
      const estado = estadoComoObjeto(objeto.estado);
      if (params.resultados) estado.colecaoId = garantirColecao(p, params.resultados).id;
      if (params.estatisticas) estado.colecaoEstatisticasId = garantirColecao(p, params.estatisticas).id;
      if (params.semente !== undefined) estado.semente = params.semente;
      if (params.rodada !== undefined) estado.rodada = params.rodada;
      objeto.estado = estado;
      if (registro) {
        const i = p.historicoEstatisticas.findIndex((r) => (r as { id?: unknown } | null)?.id === registro.id);
        if (i === -1) p.historicoEstatisticas.push(structuredClone(registro));
        else p.historicoEstatisticas[i] = structuredClone(registro);
      }
    },
    fusao: {
      chave: `simulador:${params.objetoId}:${params.execucaoId}`,
      params,
      recriar: (novos) => registrarLoteSimulador(novos),
    },
  });
}

/** "Recomeçar": apaga os casos das coleções do simulador (sem apagar as coleções) e volta a rodada a zero. */
export function recomecarSimulador(objetoId: Id): Comando {
  return criarComando({
    rotulo: 'Recomeçar o simulador',
    receita: (p) => {
      const objeto = exigirObjeto(p, objetoId);
      const estado = estadoComoObjeto(objeto.estado);
      for (const campo of ['colecaoId', 'colecaoEstatisticasId']) {
        const id = estado[campo];
        const colecao = typeof id === 'string' ? p.colecoes.find((c) => c.id === id) : undefined;
        if (colecao) colecao.casos = [];
      }
      estado.rodada = 0;
      objeto.estado = estado;
    },
  });
}
