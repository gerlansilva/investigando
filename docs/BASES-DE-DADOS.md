# Bases de dados no Investigando

Menu **Bases de dados** (barra superior). Cada base entra na mesa como uma Tabela, mais um quadro de texto com a fonte e a licença.

## Já incluídas

| Base | Casos | Licença | Fonte |
|---|---|---|---|
| **Pinguins de Palmer** | 344 | CC0 (domínio público) | Gorman, Williams e Fraser (2014), Estação Palmer (LTER); pacote [palmerpenguins](https://allisonhorst.github.io/palmerpenguins/) |
| **Zoológico** | 100 | CC BY 4.0 | Forsyth, R. (1990). Zoo. UCI Machine Learning Repository. <https://doi.org/10.24432/C5R59V> |
| **Pesquisa da turma** | 0 (modelo) | Livre | Tabela vazia (nome, altura, calçado, transporte, brincadeira) para a turma preencher |

Mudanças que fizemos: nomes e valores traduzidos para o português; no Zoológico, o registro "girl" (menina) do original foi retirado.

## Importar um CSV

**Bases de dados → Importar arquivo CSV…** Requisitos:

- primeira linha com os títulos das colunas;
- separador vírgula, ponto e vírgula ou tab (o programa descobre sozinho);
- até 5000 linhas e 40 colunas.

O programa reconhece **número**, **categoria** (poucos valores que se repetem) e **texto**. Células vazias ou com `NA`, `N/A`, `NaN`, `null`, `-` e `?` ficam sem valor. Depois de importar, o tipo de cada coluna pode ser mudado na própria tabela.

## Onde encontrar mais dados

Sugestões que costumam render boas perguntas com crianças. **Confira a licença na página de cada base antes de usar em sala ou divulgar o trabalho**, e cite a fonte.

- **Animais:** Zoo Animals Extended (Kaggle, `agajorte`); sono dos mamíferos (62 espécies; a licença pode ser só para uso não comercial).
- **Comida e corpo:** 80 Cereais (Kaggle); laranjas vs. toranjas (Kaggle).
- **Natureza e clima:** furacões do Atlântico (NOAA).
- **Jogos e cultura infantil:** Pokémon (Kaggle). Os dados são fatos, mas os nomes são marcas registradas.
- **Brasil:** IBGE (<https://www.ibge.gov.br>) e INMET (<https://portal.inmet.gov.br>) publicam tabelas que cabem em CSV.

Quando o Kaggle pedir login, baixe o arquivo `.csv` no computador e use a importação.

## A melhor base é a da turma

Altura, número do calçado, tempo até a escola, brincadeira favorita. A investigação nasce de uma pergunta dos alunos, e o modelo **Pesquisa da turma** já traz as colunas mais comuns. Basta usar **Novo caso** na barra de ferramentas da etapa Dados.
