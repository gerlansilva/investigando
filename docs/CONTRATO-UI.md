# Contrato da interface (fases 3 e 4)

Leia também `docs/CONTRATO.md`. Interface 100% em português do Brasil; todo texto visível vem de `src/i18n/pt-BR.ts` (acrescente chaves por seção, sem apagar as dos outros agentes: cada agente só adiciona dentro do seu próprio sub-objeto).
Rodar: `npx vitest run`, `npx tsc --noEmit`, `npx vite build`. Componentes testados com Testing Library em jsdom (arquivos `*.test.tsx` ao lado do código). `src/{app,objetos}/**` roda em jsdom.
Público: crianças do ensino fundamental. Alvos de toque/clique grandes (mínimo 40 px), contraste alto, rótulos legíveis, sem jargão. Acessível por teclado (foco visível, atributos aria em pt-BR).
Estilo: CSS simples com variáveis (arquivo `.css` por componente ou módulo); sem biblioteca de UI.
Propriedade intelectual: não copiar nada do TinkerPlots; código do CODAP só adaptado com cabeçalho de origem e aviso Concord Consortium.

## Donos de pastas
- Agente Mesa (fase 3): `src/app/`, `src/objetos/tabela/`, `src/objetos/fichas/`, `src/objetos/texto/`, `src/objetos/imagem/`, `src/estado/usarArmazem.ts` (hook React sobre `criarArmazem` de `src/estado/store.ts`).
- Agente Gráfico Visual (fase 4): `src/objetos/grafico/` somente.
- Não editar `src/modelo`, `src/estado/*` (exceto o novo arquivo do hook), `src/formulas`, `src/grafico/algoritmos`. Se precisar de mudança lá, descreva no relatório final em vez de alterar.

## Interface comum dos objetos da mesa
Todo componente de objeto recebe:
```ts
interface PropsObjeto<E = unknown> {
  objeto: ObjetoMesa;            // de src/modelo/tipos.ts; objeto.estado é do tipo E
  colecao: Colecao | undefined;  // coleção ligada via objeto.estado.colecaoId
  selecao: ReadonlySet<Id>;      // casos selecionados dessa coleção
  aoSelecionar(ids: Id[], modo: 'substituir'|'alternar'|'limpar'): void;
  executar(comando: Comando): void;  // histórico; ver src/estado/comandos
  selarHistorico(): void;            // chamar ao soltar mouse/terminar edição contínua
  perfil: 'iniciais' | 'finais';     // anos iniciais escondem ferramentas avançadas
}
```
O Agente Mesa define e exporta esse tipo em `src/app/tiposObjeto.ts` (já criado por mim abaixo? NÃO: crie-o você primeiro, em minutos, para o Agente Gráfico Visual importar; o Agente Gráfico Visual deve esperar que o arquivo exista ou usar a definição acima e reconciliar depois).

## Estado do objeto gráfico (src/objetos/grafico/estado.ts, dono: Gráfico Visual)
`{ colecaoId: Id; x: EixoCfg | null; y: EixoCfg | null; corPor?: Id; icone: {forma:'circulo'|'quadrado'; tamanho:number}; mostrar: ('media'|'mediana'|'moda')[]; filtro?: string; semente: number }`, com `EixoCfg = { atributoId: Id; modo: 'separar'|'ordenar'|'empilhar'|'intervalos'; intervalos?: {largura?: number} }`. Alterações vão por comando `mudarEstadoObjeto`.
