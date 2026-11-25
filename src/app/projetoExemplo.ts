import type { Atributo, Caso, Colecao, ObjetoMesa, Projeto } from '../modelo/tipos';

/** Gerador pseudoaleatório determinístico (mulberry32): o exemplo é sempre o mesmo. */
function criarSorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEIOS: { nome: string; peso: number; minimo: number; maximo: number }[] = [
  { nome: 'A pé', peso: 7, minimo: 5, maximo: 25 },
  { nome: 'Bicicleta', peso: 4, minimo: 8, maximo: 20 },
  { nome: 'Ônibus', peso: 6, minimo: 15, maximo: 50 },
  { nome: 'Carro', peso: 5, minimo: 10, maximo: 35 },
  { nome: 'Van escolar', peso: 3, minimo: 20, maximo: 45 },
];

export const ID_COLECAO_EXEMPLO = 'exemplo-colecao';
export const TITULO_EXEMPLO = 'Como viemos para a escola?';

/** Projeto de exemplo com dados fictícios (inventados para o programa). */
export function criarProjetoExemplo(agora: string = new Date().toISOString()): Projeto {
  const sorteio = criarSorteio(2024);
  const total = MEIOS.reduce((s, m) => s + m.peso, 0);
  const atributos: Atributo[] = [
    { id: 'exemplo-atr-nome', nome: 'Nome', tipo: 'texto', cor: '#2a6fdb' },
    { id: 'exemplo-atr-meio', nome: 'Meio de transporte', tipo: 'categorico', cor: '#e07a1f' },
    { id: 'exemplo-atr-tempo', nome: 'Tempo de viagem', tipo: 'numerico', cor: '#2f9e6e', unidade: 'min' },
  ];
  const casos: Caso[] = [];
  for (let i = 1; i <= 25; i++) {
    let r = sorteio() * total;
    const meio = MEIOS.find((m) => (r -= m.peso) < 0) ?? MEIOS[0]!;
    const tempo = Math.round(meio.minimo + sorteio() * (meio.maximo - meio.minimo));
    casos.push({
      id: `exemplo-caso-${i}`,
      valores: {
        'exemplo-atr-nome': `A${String(i).padStart(2, '0')}`,
        'exemplo-atr-meio': meio.nome,
        'exemplo-atr-tempo': tempo,
      },
    });
  }
  const colecao: Colecao = { id: ID_COLECAO_EXEMPLO, nome: 'Turma', atributos, casos };
  // Cada etapa tem seus objetos; todos usam a mesma coleção (os dados não são copiados).
  // Os quadros de uma mesma etapa ficam alinhados e sem sobreposição.
  const objetos: ObjetoMesa[] = [
    {
      id: 'exemplo-obj-pergunta', tipo: 'texto', x: 24, y: 24, l: 420, a: 150, etapa: 'problema',
      estado: { texto: 'Nossa pergunta: como os alunos da turma vêm para a escola? Quanto tempo a viagem demora?' },
    },
    { id: 'exemplo-obj-tabela-plano', tipo: 'tabela', x: 24, y: 24, l: 520, a: 300, etapa: 'plano', estado: { colecaoId: ID_COLECAO_EXEMPLO } },
    { id: 'exemplo-obj-tabela', tipo: 'tabela', x: 24, y: 24, l: 520, a: 380, etapa: 'dados', estado: { colecaoId: ID_COLECAO_EXEMPLO } },
    { id: 'exemplo-obj-fichas', tipo: 'fichas', x: 560, y: 24, l: 480, a: 460, etapa: 'dados', estado: { colecaoId: ID_COLECAO_EXEMPLO } },
    {
      id: 'exemplo-obj-grafico', tipo: 'grafico', x: 24, y: 24, l: 760, a: 440, etapa: 'analise',
      estado: {
        colecaoId: ID_COLECAO_EXEMPLO,
        x: { atributoId: 'exemplo-atr-meio', modo: 'separar' },
        y: null,
        corPor: 'exemplo-atr-meio',
        icone: { forma: 'circulo', tamanho: 12 },
        mostrar: ['contagem'],
        semente: 7,
      },
    },
  ];
  return {
    versao: 1,
    id: 'exemplo-projeto',
    titulo: TITULO_EXEMPLO,
    cicloAtual: 'problema',
    ciclos: [{ n: 1, pergunta: 'Como os alunos da turma vêm para a escola?', etapasConcluidas: [] }],
    colecoes: [colecao],
    objetos,
    globais: {},
    historicoEstatisticas: [],
    criadoEm: agora,
    modificadoEm: agora,
  };
}
