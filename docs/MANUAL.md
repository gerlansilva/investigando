# Manual do Investigando

O **Investigando** é um programa para o ensino fundamental que une o **ciclo investigativo PPDAC** (Problema, Plano, Dados, Análise, Conclusão) a uma mesa de trabalho livre, inspirada na forma de explorar dados do TinkerPlots: tabela, fichas, gráfico de pontos soltos, simulador, texto e imagem, todos ligados entre si.

Tudo fica no seu computador. Os arquivos têm a extensão `.investigando`.

## 1. Visão geral da tela

Em cima ficam **Abrir**, **Salvar**, **Imprimir**, **Desfazer/Refazer**, **Organizar**, o **Perfil** (Anos iniciais / Anos finais) e o **Professor**. À esquerda, a coluna **Novo** cria objetos. No centro, as cinco etapas do ciclo e a pergunta da turma.

![Etapa Problema](imagens/01-problema.png)

## 2. As etapas do ciclo

### Problema
Escreva a pergunta da turma. O botão **Moldes de pergunta** oferece modelos para ajudar a formulá-la.

![Moldes de pergunta](imagens/02-moldes.png)

### Plano
Combine o que será observado e como os dados serão registrados.

![Etapa Plano](imagens/04-plano.png)

### Dados
Anote o que descobriu sobre cada pessoa ou coisa. A **Tabela** e as **Fichas** mostram os mesmos casos; mudar um muda o outro.

![Etapa Dados](imagens/05-dados.png)

### Análise
Monte um **Gráfico** escolhendo uma variável na horizontal e, se quiser, outra na vertical. Os pontos são soltos: cada um é um caso. Use as ferramentas da barra superior para separar, empilhar e contar.

![Etapa Análise](imagens/06-analise.png)

### Conclusão
Responda à pergunta com base no que viu no gráfico.

![Etapa Conclusão](imagens/07-conclusao.png)

O botão **Marcar etapa como concluída** registra o avanço. **Resumo** mostra um painel com o percurso.

![Resumo](imagens/03-resumo.png)

## 3. Objetos da mesa

| Objeto | Para que serve |
|---|---|
| Tabela | Registrar casos e variáveis (texto, categoria, número). |
| Fichas | Ver cada caso como uma ficha. |
| Gráfico | Pontos soltos para organizar e comparar. |
| Simulador | Sortear com roleta para testar ideias de acaso. |
| Texto | Anotar ideias e conclusões. |
| Imagem | Inserir uma foto ou desenho. |

### Simulador
Configure os setores (nome e peso) e sorteie.

![Simulador](imagens/08-simulador.png)

### Texto
![Texto](imagens/09-texto.png)

### Organizar
O botão **Organizar** arruma os objetos na mesa.

![Organizar](imagens/10-organizar.png)

## 4. Modo professor

Em **Professor** é possível limitar o que o aluno altera, com **PIN opcional**, e ligar o **registro de pesquisa**. O registro vem desligado, guarda só o tipo de evento e a hora (sem nomes nem textos), fica neste computador e pode ser exportado em JSON ou CSV.

![Modo professor](imagens/11-professor.png)

## 5. Salvar, abrir e imprimir

- **Salvar** grava um arquivo `.investigando`; **Abrir** carrega um.
- **Imprimir** gera uma página limpa (use "Salvar como PDF" no diálogo).
- Desfazer/Refazer valem para todas as ações da mesa.

## 6. Acessibilidade

Fontes legíveis, alto contraste, navegação por teclado e rótulos para leitores de tela. Se encontrar algo que atrapalhe, abra uma *issue* no repositório.
