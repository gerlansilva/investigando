# Investigando

App educacional (Tauri + React + TypeScript) que une o ciclo investigativo PPDAC à mecânica do TinkerPlots, para o ensino fundamental. Interface em português do Brasil.

## Rodar no navegador (desenvolvimento)
    npm install
    npm run dev        # http://localhost:1420
    npm test           # suíte completa (~600 testes)
    npm run tipos      # checagem de tipos
    npm run construir  # build de produção

## Estado atual
Fases 1 a 9 prontas no código (modelo e estado com desfazer/refazer, fórmulas, mesa livre, tabela, fichas, gráfico de pontos, simulador, texto, imagem, modo professor, diário de pesquisa, acessibilidade, exportar e imprimir). Logo e ícones aplicados.
Ainda não verificado na prática: build nativo do Tauri no Mac, abrir arquivos `.investigando` com duplo clique, impressão em impressora e leitor de tela.

## Instalar no Mac
Veja `docs/EMPACOTAR-MAC.md`. O caminho mais simples é o fluxo "Instaladores" do GitHub Actions, que gera o `.dmg`.

## Regras
- Reimplementar o comportamento do TinkerPlots; não copiar código, imagens nem arquivos .tp3.
- Código adaptado do CODAP (MIT) deve manter cabeçalho de origem e aviso de copyright do Concord Consortium.

## Documentação

- [Manual do usuário (com imagens)](docs/MANUAL.md)
- [Instalar no Mac e no Windows](docs/INSTALAR.md)
