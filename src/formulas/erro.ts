export class ErroFormula extends Error {
  constructor(
    readonly mensagem: string,
    readonly inicio: number,
    readonly fim: number,
  ) {
    super(mensagem);
    this.name = 'ErroFormula';
  }

  trechoEm(formula: string): string {
    return formula.slice(this.inicio, this.fim);
  }
}
