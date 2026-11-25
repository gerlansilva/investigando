/**
 * Ícones próprios do Investigando: traço simples de 1,75 px em grade de 24 px, desenhados para este app.
 * São decorativos (aria-hidden): o botão que os contém é quem tem o nome acessível.
 */
const TRACOS = {
  abrir: 'M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.5h8.5A1.5 1.5 0 0 1 21 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z',
  salvar: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14',
  desfazer: 'M8 5 4 9l4 4M4 9h9.5a5.5 5.5 0 0 1 0 11H9',
  refazer: 'M16 5l4 4-4 4M20 9h-9.5a5.5 5.5 0 0 0 0 11H15',
  tabela: 'M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M4 14.5h16M10 5v14',
  fichas: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 9h8M8 12.5h8M8 16h5',
  grafico: 'M4 4v16h16',
  simulador: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z',
  texto: 'M5 6h14M12 6v13M9 19h6',
  imagem: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 18l5-5 4 4 3-3 4 4',
  novoCaso: 'M4 7h12M4 12h8M4 17h8M18 13v7M14.5 16.5h7',
  novoAtributo: 'M6 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM18 9v6M15 12h6',
  apagar: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5',
  esconder: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4 4l16 16',
  mostrar: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
  separar: 'M4 20h16',
  empilhar: 'M4 20h16',
  ordenar: 'M4 20h16M6 17l12-9',
  intervalos: 'M4 20h16M5 20v-7h4v7M10 20V8h4v12M15 20v-5h4v5',
  contagem: 'M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16',
  porcentagem: 'M18 5.5 6 18.5',
  media: 'M3 13h18M12 13l-3.5 7h7z',
  mediana: 'M12 4v16',
  moda: 'M4 20h16M5 17l4.5-4 2.5-8 2.5 8 4.5 4',
  remexer: 'M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.5 0 2.5-1.5 3.5-3M13 10c1-1.6 2-3 3.5-3H20M17 14l3 3-3 3M17 4l3 3-3 3',
  trocarEixos: 'M7 4v14M3.5 7.5 7 4l3.5 3.5M17 20V6M13.5 16.5 17 20l3.5-3.5',
  salvarImagem: 'M12 4v9M8.5 9.5 12 13l3.5-3.5M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16',
  circulo: 'M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
  quadrado: 'M7.5 7.5h9v9h-9z',
  organizar: 'M5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4A1.5 1.5 0 0 1 5.5 4zM14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4A1.5 1.5 0 0 1 14.5 4zM5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4A1.5 1.5 0 0 1 5.5 13zM14.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z',
  mesaLivre: 'M12 4 3 9l9 5 9-5zM3 14l9 5 9-5',
  resumo: 'M7 4h7l5 5v11H7zM14 4v5h5M10 13h6M10 16.5h6',
  check: 'M5 12.5 9.5 17 19 7.5',
  mais: '',
  seta: 'M6 9.5l6 6 6-6',
  fechar: 'M6 6l12 12M18 6 6 18',
  sortear: 'M8 5v14l11-7z',
  parar: 'M7 7h10v10H7z',
  recomecar: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5',
  roleta: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 12V4M12 12l6.9 4M12 12l-6.9 4',
  misturador: 'M5 11h14l-1.5 7a2 2 0 0 1-2 1.6h-7a2 2 0 0 1-2-1.6z',
  contador: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v8M8 12h8',
  filtro: 'M4 5h16l-6 8v6l-4-2v-4z',
  conter: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8.5 9h7v6h-7z',
  cobrir: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 9.5h18M3 14.5h18',
  imprimir: 'M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2M7 14h10v6H7z',
  exportarPdf: 'M7 3.5h7l5 5V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 7 20zM14 3.5v5h5M9.5 13h5M9.5 16.5h5',
  novoCiclo: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5',
} as const;

/** Pontos cheios (pequenos círculos) de alguns ícones; cada um é [cx, cy, r]. */
const PONTOS: Partial<Record<NomeIcone, readonly (readonly [number, number, number])[]>> = {
  grafico: [[8.5, 16, 1.3], [8.5, 12.5, 1.3], [12.5, 16, 1.3], [12.5, 12.5, 1.3], [12.5, 9, 1.3], [16.5, 16, 1.3]],
  simulador: [[9, 9, 1.3], [15, 9, 1.3], [12, 12, 1.3], [9, 15, 1.3], [15, 15, 1.3]],
  separar: [[6.5, 7, 1.5], [9, 13, 1.5], [7, 17, 1.5], [13, 9.5, 1.5], [12, 15.5, 1.5], [18, 6.5, 1.5], [18.5, 13, 1.5]],
  empilhar: [[7, 16.5, 1.6], [7, 12.5, 1.6], [7, 8.5, 1.6], [12, 16.5, 1.6], [12, 12.5, 1.6], [17, 16.5, 1.6]],
  ordenar: [[6.5, 15.5, 1.5], [10.5, 13, 1.5], [14.5, 10.5, 1.5], [18, 8, 1.5]],
  porcentagem: [[7.5, 7.5, 2.2], [16.5, 16.5, 2.2]],
  mediana: [[6.5, 9, 1.5], [8.5, 14, 1.5], [15.5, 10, 1.5], [17.5, 15, 1.5]],
  media: [[6, 10, 1.5], [10, 8, 1.5], [15, 9.5, 1.5], [19, 11, 1.5]],
  mais: [[6, 12, 1.6], [12, 12, 1.6], [18, 12, 1.6]],
  misturador: [[9, 7.5, 2], [14, 6.5, 2], [16.5, 9, 1.6]],
};

const PREENCHIDOS = new Set<string>([]); // ícones só de traço: sem preenchimento colorido

export type NomeIcone = keyof typeof TRACOS;

export function Icone({ nome, tamanho }: { nome: NomeIcone; tamanho?: number }) {
  const lado = tamanho ?? undefined;
  return (
    <svg
      className="icone"
      width={lado}
      height={lado}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACOS[nome] && PREENCHIDOS.has(nome) && <path d={TRACOS[nome]} fill="currentColor" fillOpacity={0.14} stroke="none" />}
      {TRACOS[nome] && <path d={TRACOS[nome]} />}
      {PONTOS[nome]?.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="var(--icone-ponto, currentColor)" stroke="none" />)}
    </svg>
  );
}
