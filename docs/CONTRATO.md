# Contrato da fase 1 — Investigando

App: Tauri + React + TypeScript (a interface vem em fases posteriores). Interface e mensagens em português do Brasil.
Regra: `src/modelo`, `src/estado`, `src/formulas` e `src/grafico/algoritmos` são **puros**: não importam React, Tauri nem DOM.
Regra de propriedade intelectual: reimplementar comportamento do zero. Não copiar código, imagens nem arquivos .tp3 do TinkerPlots. Código do CODAP (MIT) só se adaptado com cabeçalho de origem e aviso de copyright (Concord Consortium).

## Donos de pastas (não editar a pasta do outro agente)
- Agente Núcleo: `src/modelo/`, `src/estado/`, `src/formulas/`
- Agente Gráfico: `src/grafico/algoritmos/`
- Configuração (package.json, tsconfig, vitest): já pronta; só acrescentar dependências se indispensável e avisar no relatório final.

## Modelo de dados (src/modelo/tipos.ts)
```ts
type Id = string;
type TipoAtributo = 'numerico'|'categorico'|'texto'|'data';
interface Atributo { id: Id; nome: string; tipo: TipoAtributo; cor: string; unidade?: string; formula?: string; formato?: {casas?: number} }
interface Caso { id: Id; valores: Record<Id, number|string|null>; oculto?: boolean }
interface Colecao { id: Id; nome: string; atributos: Atributo[]; casos: Caso[] }
type EtapaCiclo = 'problema'|'plano'|'dados'|'analise'|'conclusao';
type TipoObjeto = 'tabela'|'fichas'|'grafico'|'simulador'|'texto'|'imagem'|'controle';
interface ObjetoMesa { id: Id; tipo: TipoObjeto; x:number; y:number; l:number; a:number; etapa: EtapaCiclo; estado: unknown }
interface Projeto { versao: 1; id: Id; titulo: string; autor?: string; cicloAtual: EtapaCiclo;
  ciclos: {n:number; pergunta:string; etapasConcluidas: EtapaCiclo[]}[];
  colecoes: Colecao[]; objetos: ObjetoMesa[]; globais: Record<string, number>;
  historicoEstatisticas: unknown[]; criadoEm: string; modificadoEm: string }
```
Casos guardam valores por `atributo.id`. Seleção de casos e pilhas de desfazer **não** são salvas no arquivo.

## Estado e comandos
- Store Zustand com `projeto` + estado efêmero (`selecaoCasos: Record<colecaoId, Set<Id>>`).
- `Comando { rotulo: string; aplicar(p: Projeto): void; reverter(p: Projeto): void; fundirCom?(outro: Comando): Comando | null }`; usar `produceWithPatches` do Immer para gerar `reverter`.
- Pilhas desfazer/refazer; comando novo limpa refazer; seleção não entra no histórico.

## Gráfico (src/grafico/algoritmos), tudo função pura sobre números
Entrada: valores e/ou categorias por caso, dimensões da área, diâmetro do ponto. Saída: posições normalizadas ou em pixels.
Operações: separar (categórico e numérico), ordenar, empilhar (com compactação do passo quando n×diâmetro > altura), intervalos (início = piso(min/largura)×largura; índice = piso((v−início)/largura); último intervalo fechado à direita; largura padrão pela regra de Sturges), médias (média, mediana, moda sobre casos visíveis), contagem e porcentagem por grupo.
Casos de borda obrigatórios nos testes: vazio, um ponto, valores iguais, nulos, mínimo e máximo exatos no limite do intervalo.
