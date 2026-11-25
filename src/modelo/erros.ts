export class ErroArquivo extends Error {
  readonly detalhes: string[];

  constructor(mensagem: string, detalhes: string[] = []) {
    super(detalhes.length ? `${mensagem}\n- ${detalhes.join('\n- ')}` : mensagem);
    this.name = 'ErroArquivo';
    this.detalhes = detalhes;
  }
}
