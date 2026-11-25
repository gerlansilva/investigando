export * from './erro';
export * from './tipos';
export { tokenizar } from './lexer';
export { analisar, compilar, referenciasDe, type No } from './parser';
export { acharAtributo, avaliarArvore, avaliarFormula, avaliarNo } from './avaliador';
export { recalcularAtributo, recalcularColecao, type ResultadoAtributo } from './recalculo';
export { buscarFuncao, funcoesDisponiveis, criarPrng, hashTexto } from './funcoes';
export { paraValorDeCaso } from './valores';
