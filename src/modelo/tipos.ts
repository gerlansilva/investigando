export type Id = string;
export type TipoAtributo = 'numerico' | 'categorico' | 'texto' | 'data';
export type ValorCelula = number | string | null;

export interface Atributo {
  id: Id;
  nome: string;
  tipo: TipoAtributo;
  cor: string;
  unidade?: string;
  formula?: string;
  formato?: { casas?: number };
}

export interface Caso {
  id: Id;
  valores: Record<Id, ValorCelula>;
  oculto?: boolean;
}

export interface Colecao {
  id: Id;
  nome: string;
  atributos: Atributo[];
  casos: Caso[];
}

export type EtapaCiclo = 'problema' | 'plano' | 'dados' | 'analise' | 'conclusao';
export type TipoObjeto = 'tabela' | 'fichas' | 'grafico' | 'simulador' | 'texto' | 'imagem' | 'controle';

export interface ObjetoMesa {
  id: Id;
  tipo: TipoObjeto;
  x: number;
  y: number;
  l: number;
  a: number;
  etapa: EtapaCiclo;
  /** Nome dado pela pessoa à janela (opcional). */
  titulo?: string;
  estado: unknown;
}

/** Conclusão de um ciclo. Os campos do roteiro (vi, mostra, naoSei) são opcionais; `texto` é a junção deles. */
export interface ConclusaoCiclo {
  texto: string;
  limites: string;
  vi?: string;
  mostra?: string;
  naoSei?: string;
}

export interface CicloInvestigativo {
  n: number;
  pergunta: string;
  etapasConcluidas: EtapaCiclo[];
  /** Campos opcionais: arquivos antigos não os têm. */
  conclusao?: ConclusaoCiclo;
  arquivado?: boolean;
}

/** Perfil de ensino que o professor pode fixar. */
export type PerfilFixo = 'iniciais' | 'finais';

/** Modo professor (opcional por projeto): limites que a interface do aluno respeita enquanto `ativo`. O PIN guarda só sal e hash. */
export interface ModoProfessor {
  ativo: boolean;
  etapasTravadas: EtapaCiclo[];
  tiposOcultos: TipoObjeto[];
  perfilFixo?: PerfilFixo;
  /** Ajustes por ferramenta (ligada/desligada) que valem mais que o perfil. */
  ferramentas?: Record<string, boolean>;
  pin?: { sal: string; hash: string };
}

export interface Projeto {
  versao: 1;
  id: Id;
  titulo: string;
  autor?: string;
  cicloAtual: EtapaCiclo;
  ciclos: CicloInvestigativo[];
  colecoes: Colecao[];
  objetos: ObjetoMesa[];
  globais: Record<string, number>;
  historicoEstatisticas: unknown[];
  /** Opcional: arquivos antigos não têm. */
  professor?: ModoProfessor;
  criadoEm: string;
  modificadoEm: string;
}

export const ETAPAS: readonly EtapaCiclo[] = ['problema', 'plano', 'dados', 'analise', 'conclusao'];
export const TIPOS_OBJETO: readonly TipoObjeto[] = ['tabela', 'fichas', 'grafico', 'simulador', 'texto', 'imagem', 'controle'];
export const TIPOS_ATRIBUTO: readonly TipoAtributo[] = ['numerico', 'categorico', 'texto', 'data'];
