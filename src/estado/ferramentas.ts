// Ferramentas do gráfico que o perfil liga ou desliga por padrão e que o professor pode ajustar uma a uma.
export const FERRAMENTAS_GRAFICO = [
  'ordenar', 'intervalos', 'porcentagem', 'media', 'mediana', 'moda', 'trocarEixos', 'corPor', 'filtro', 'salvarImagem', 'exportarPdf',
] as const;
export type FerramentaGrafico = (typeof FERRAMENTAS_GRAFICO)[number];

export type AjustesDeFerramentas = Readonly<Record<string, boolean>> | undefined;

/** O ajuste do professor vence; sem ajuste, vale o perfil (o "Completo" liga todas e o "Básico" desliga todas). */
export function ferramentaLigada(perfil: 'iniciais' | 'finais', ajustes: AjustesDeFerramentas, id: FerramentaGrafico): boolean {
  return ajustes?.[id] ?? perfil === 'finais';
}
