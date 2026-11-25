# Validação da Fase 9: qualidade, acessibilidade e robustez

Método: `npx vite build`, servidor estático e Chrome headless (Playwright) com roteiros em `/tmp/val` (fora do projeto): teclado, contraste calculado, axe-core (WCAG 2.2 AA), viewports, arquivos corrompidos, 5.000 casos, 200 desfazeres, `prefers-reduced-motion`.
Correções: `src/app/acessibilidade.css` (importado por último em `src/main.tsx`) mais pontos pequenos em TSX. Testes de regressão: `src/app/acessibilidade.test.tsx` (22 testes).

## Corrigido
| Área | Achado | Correção |
|---|---|---|
| Alvos | Abas de etapa, "Marcar etapa como concluída", seletor de perfil, menus, campos do gráfico e do simulador, fichas e células da tabela tinham 32 a 36 px; alça de redimensionar 28 px; perfil "Anos finais" usava 32 px | Mínimo de 40 px (`--alvo-minimo`), perfil finais com `--alvo: 40px`, alça e barra da janela com 40 px |
| Contraste | Borda dos campos (select, número, texto, pergunta) com 1,44:1, abaixo dos 3:1 da WCAG 1.4.11 | Borda `--cor-borda-forte` (3,38:1); fichas ganham linha inferior forte |
| Viewports | 1024/800/600: barra contextual do gráfico saía da tela (rolagem interna escondia ferramentas); 600 px: trilha de etapas estourava a largura (rolagem horizontal da página) | Barra contextual e trilha de etapas quebram linha; aviso com título longo quebra (`overflow-wrap`) |
| Teclado | Esc no aviso de apagar e Esc/Enter ao renomear jogavam o foco para o `body`; apagar janela também | Foco volta ao menu "Opções", à barra da janela ou à mesa. Esc ao renomear não grava o nome (antes o blur confirmava) |
| Estrutura | Sem landmark `main` nem como pular a barra (WCAG 2.4.1) | `<main>` e link "Pular para a mesa de trabalho" (primeiro da tabulação) |
| ARIA | `aria-label` em `<g>` do ponteiro da roleta (proibido); alça `separator` focável sem `aria-valuenow` (axe crítico) | Ponteiro `aria-hidden`; alça com `aria-valuenow` e `aria-valuetext` ("520 por 380") |
| Foco | Barra contextual com overflow cortava o contorno; alça só aparecia ao pairar | Contorno de 3 px nas ferramentas, abas, barra e alça; alça visível ao focar |
| Movimento | Paleta e efeitos de pairar tinham transição/transform fora da regra global | Regra final em `acessibilidade.css` (transições 0,01 ms, sem transform ao pairar); animações em JS já respeitavam a preferência |
| Outros | 404 de favicon no console | `<link rel="icon" href="data:,">` |

## Verificado sem problemas
- Teclado: Tab/Shift+Tab em todas as etapas com todos os tipos de objeto, sem armadilha; foco visível em todos os elementos tabulados; Ctrl/Cmd+Z, Ctrl+Shift+Z/Y, setas movem janela, F2 renomeia, Esc fecha menu, aviso e Resumo; setas entre etapas.
- Contraste de texto (cálculo sobre o fundo efetivo, perfis iniciais e finais, todas as etapas, Resumo): nenhum texto habilitado abaixo de 4,5:1 (texto 16,7; suave 6,7; destaque 9,7; perigo 5,9; sucesso 5,0). Desabilitados são isentos.
- Viewports 1300/1024/800/600, os dois perfis, etapas Problema/Dados/Análise/Conclusão: sem sobreposição de controles e sem rolagem horizontal da página. A mesa continua rolando (por desenho) quando uma janela é maior que ela.
- Arquivos: 21 variantes (vazio, binário, truncado, array, null, sem versão, versão 0 e 99, tipos errados, `estado` inválido em cada tipo de objeto, coleção/atributo inexistente, valores sujos, tamanho zero, sem ciclos, título com HTML e 400 caracteres, antigo sem campos opcionais): mensagem em português ou abertura normal; nenhuma exceção nem tela branca.
- 5.000 casos: abre em 0,2 s, gráfico em 0,4 s, trocar eixo 140 a 230 ms, Ctrl+A em 0,3 s, tabela com 27 linhas no DOM (virtualizada); sem erros.
- Desfazer: 210 ações, 200 desfeitas e 200 refeitas em teclas, limite respeitado, sem erro.
- `prefers-reduced-motion: reduce`: durações de transição caem para 0,01 ms; roleta, misturador e gráfico consultam a preferência.

## Pendente (não corrigido de propósito)
1. **Fichas**: cada ficha é `role="option"` com `<input>` dentro (axe `nested-interactive`, 25 nós) e cada campo é uma parada de Tab (75 com o exemplo). Corrigir exige mudar a semântica de `Fichas.tsx` (listbox para grupos, tabulação em "roving"), com impacto nos testes existentes.
2. **Cabeçalho da tabela**: nome acessível "Nome, Texto" difere do texto visível "Nome Texto" (axe `label-content-name-mismatch`, 2.5.3). Depende de `t.tabela.atributoDoTipo` usado em vários testes.
3. A área de "Anotações" do objeto Texto não tem borda própria (a janela delimita); cor amarela `#F0E442` da paleta categórica do gráfico tem pouco contraste com o fundo (a posição também codifica o dado).
4. Em 600 px o topo (barra + ferramentas do gráfico) chega a 280 px de altura; usável, mas a mesa fica pequena. Ideal: recolher ferramentas em menu nessa largura.
5. Sem teste automático de leitor de tela real (NVDA/VoiceOver); a revisão de ordem de leitura foi pela ordem do DOM (igual à de tabulação: barra, Novo, etapas, pergunta, mesa).
