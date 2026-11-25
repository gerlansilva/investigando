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

## Sono dos mamíferos

83 espécies com horas de sono total e REM, tempo acordado, massa do corpo e do cérebro. Fonte: Savage e West (2007), via conjunto `msleep` do pacote ggplot2. A licença é "dados de pesquisa publicados, uso educacional, com crédito à fonte" (leitura do projeto; não há licença própria do conjunto). Boa para comparar "quem dorme mais" e relacionar sono com tamanho.

## Pokémon e outras bases com marca registrada

Não vão embutidas: nomes e personagens são marca de terceiros. Quem quiser usar importa o CSV por **Bases de dados → Importar arquivo CSV…**.

## Bases adicionadas em 25/11/2026

| Base | Casos | Licença | Alterações feitas |
|---|---:|---|---|
| Cereais matinais | 77 | CC BY-SA 3.0 | colunas e fabricantes em português; -1 vira célula vazia |
| Incêndios florestais | 517 | CC BY 4.0 | colunas, meses e dias em português |
| Tamanho de seres vivos | 106 | Apache-2.0 | só animais e plantas; nomes em português (texto da licença em `docs/licencas/Apache-2.0.txt`) |
| Brasil nos Jogos Olímpicos | 3.848 | CC0 | só atletas do Brasil, sem os nomes; textos em português |

Os créditos de cada base aparecem na tabela inserida no projeto. A licença CC BY-SA dos cereais vale para esses dados, não para o programa.

| Pokémon (1ª a 7ª geração) | 801 | CC0 declarada na fonte | só parte das colunas; tipos em português; aviso de marca registrada nos créditos |
| Filmes e séries do Disney+ | 894 | CC0 declarada na fonte | sem sinopses, elenco e direção; textos em português; aviso de marca registrada nos créditos |

Pokémon e Disney+ são marcas de terceiros: a licença CC0 vale para a tabela, não para os nomes. Por isso os créditos trazem um aviso e as bases só têm números de referência (sem imagens, sinopses ou textos).

**Fora do pacote** (importe pelo menu se quiser): Spotify, Bigfoot, Star Wars e Datasaurus (licença desconhecida ou pendente), e a base de sono do Kaggle (licença divergente).
