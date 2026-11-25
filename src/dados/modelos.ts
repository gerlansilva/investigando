import type { BaseDeDados } from './bases';

/** Modelos vazios para a turma preencher com os próprios dados. */
export const MODELOS: readonly BaseDeDados[] = [
  {
    id: 'pesquisa-da-turma',
    nome: 'Pesquisa da turma',
    descricao: 'Tabela vazia com perguntas comuns de uma pesquisa em sala. Troque, apague ou crie colunas.',
    fonte: 'Modelo do programa Investigando.',
    licenca: 'Livre',
    url: '',
    atributos: [
      ['Nome', 'texto'],
      ['Altura', 'numerico', 'cm'],
      ['Número do calçado', 'numerico'],
      ['Meio de transporte', 'categorico'],
      ['Brincadeira favorita', 'categorico'],
    ],
    linhas: [],
  },
];
