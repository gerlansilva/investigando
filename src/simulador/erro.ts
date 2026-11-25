/** Erro com mensagem em português, pronta para ser mostrada ao aluno. */
export class ErroSimulador extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroSimulador';
  }
}
