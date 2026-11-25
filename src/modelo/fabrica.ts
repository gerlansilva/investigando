import type {
  Atributo, Caso, Colecao, EtapaCiclo, Id, ObjetoMesa, Projeto, TipoAtributo, TipoObjeto, ValorCelula,
} from './tipos';

export type GeradorId = () => Id;

const configuracao: { gerarId: GeradorId; agora: () => string } = {
  gerarId: () => globalThis.crypto.randomUUID(),
  agora: () => new Date().toISOString(),
};

const padrao = { ...configuracao };

export function configurarFabrica(opcoes: { gerarId?: GeradorId; agora?: () => string }): void {
  if (opcoes.gerarId) configuracao.gerarId = opcoes.gerarId;
  if (opcoes.agora) configuracao.agora = opcoes.agora;
}

export function restaurarFabrica(): void {
  configuracao.gerarId = padrao.gerarId;
  configuracao.agora = padrao.agora;
}

export function criarContador(prefixo = 'id'): GeradorId {
  let n = 0;
  return () => `${prefixo}-${++n}`;
}

export const PALETA_ATRIBUTOS: readonly string[] = [
  '#2a6fdb', '#e07a1f', '#2f9e6e', '#c2379b', '#7a5cd6', '#d1495b', '#0f9fb5', '#8a8d1f',
];

export function gerarId(): Id {
  return configuracao.gerarId();
}

export function criarProjeto(opcoes: { titulo?: string; autor?: string } = {}): Projeto {
  const agora = configuracao.agora();
  const projeto: Projeto = {
    versao: 1,
    id: gerarId(),
    titulo: opcoes.titulo ?? 'Projeto sem título',
    cicloAtual: 'problema',
    ciclos: [{ n: 1, pergunta: '', etapasConcluidas: [] }],
    colecoes: [],
    objetos: [],
    globais: {},
    historicoEstatisticas: [],
    criadoEm: agora,
    modificadoEm: agora,
  };
  if (opcoes.autor !== undefined) projeto.autor = opcoes.autor;
  return projeto;
}

export function criarAtributo(opcoes: Partial<Omit<Atributo, 'id'>> & { nome: string; indiceCor?: number }): Atributo {
  const { indiceCor = 0, ...resto } = opcoes;
  const tipo: TipoAtributo = resto.tipo ?? 'numerico';
  return {
    cor: PALETA_ATRIBUTOS[indiceCor % PALETA_ATRIBUTOS.length]!,
    ...resto,
    id: gerarId(),
    tipo,
  };
}

export function criarCaso(valores: Record<Id, ValorCelula> = {}, oculto?: boolean): Caso {
  const caso: Caso = { id: gerarId(), valores: { ...valores } };
  if (oculto) caso.oculto = true;
  return caso;
}

export function criarColecao(nome = 'Coleção 1', atributos: Atributo[] = [], casos: Caso[] = []): Colecao {
  return { id: gerarId(), nome, atributos, casos };
}

const PADROES_OBJETO: Record<TipoObjeto, { l: number; a: number; etapa: EtapaCiclo }> = {
  tabela: { l: 420, a: 300, etapa: 'dados' },
  fichas: { l: 360, a: 280, etapa: 'dados' },
  grafico: { l: 440, a: 340, etapa: 'analise' },
  simulador: { l: 360, a: 300, etapa: 'plano' },
  texto: { l: 300, a: 160, etapa: 'problema' },
  imagem: { l: 300, a: 220, etapa: 'problema' },
  controle: { l: 220, a: 80, etapa: 'analise' },
};

export function criarObjeto(tipo: TipoObjeto, opcoes: Partial<Omit<ObjetoMesa, 'id' | 'tipo'>> = {}): ObjetoMesa {
  const base = PADROES_OBJETO[tipo];
  return { id: gerarId(), tipo, x: 40, y: 40, estado: {}, ...base, ...opcoes };
}
