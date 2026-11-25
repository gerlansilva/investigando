# Empacotar o Investigando no Mac

## Caminho mais simples: GitHub Actions (sem instalar Rust nem Xcode)

1. Crie um repositório no GitHub (pode ser privado) e envie a pasta do projeto (o `.gitignore` já ignora `node_modules`, `dist` e `src-tauri/target`).
2. Na aba **Actions**, abra o fluxo **Instaladores** e clique em **Run workflow**.
3. Quando terminar (10 a 20 minutos na primeira vez), baixe o `.dmg` em **Artifacts > Investigando-mac**, abra e arraste o app para Applications.
4. Se o fluxo falhar, a causa mais provável é um erro de compilação do Rust (nunca foi compilado antes). Copie o texto do erro do log para eu corrigir.

O build é universal (Apple Silicon e Intel) e sem assinatura. Nesta mesma pasta há uma criação por etiqueta: ao criar uma tag `v0.0.1`, o fluxo também cria um rascunho de release com o instalador.

## Caminho local (precisa de Rust e Xcode)

Pré-requisitos (Rust já instalado): Xcode Command Line Tools (`xcode-select --install`) e Node 20+.

```bash
cd investigando
npm install
npm run icones          # opcional: regera os ícones (src-tauri/icons) e public/favicon.svg
npx tsc --noEmit && npx vitest run
npm run tauri:dev       # abre o app em modo desenvolvimento (primeira compilação do Rust demora)
npm run tauri:build     # gera o .app e o .dmg
```

Resultado em `src-tauri/target/release/bundle/`:

- `macos/Investigando.app`
- `dmg/Investigando_0.0.1_aarch64.dmg` (ou `x64`, conforme o Mac)

Para um build universal (Apple Silicon + Intel):

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri:build -- --target universal-apple-darwin
```

Notas:

- App sem assinatura: ao abrir pela primeira vez, clique com o botão direito no app e escolha Abrir (ou `xattr -dr com.apple.quarantine Investigando.app`).
- Ícones: `src-tauri/icons` e `public/favicon.svg` são gerados por `npm run icones` (`src-tauri/gerar-icones.mjs`, desenho original). Edite o script e rode de novo para ajustar.
- Atalhos: Cmd+O abre, Cmd+S salva, Cmd+Shift+S salva como. Ao fechar com alterações não salvas, o app pergunta.
- Arquivos `.investigando` ficam associados ao app: duplo clique ou arrastar o arquivo sobre o ícone abre o projeto (veja abaixo).
- No app nativo, "PDF" abre o diálogo de impressão do macOS (botão PDF, Salvar como PDF).

## Testar o duplo clique

1. Rode `npm run tauri:build` e copie `Investigando.app` para `/Applications` (o Finder só registra a associação de um app instalado; se o ícone do arquivo não mudar, rode `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Investigando.app`).
2. Salve um projeto pelo app (Cmd+S) para ter um `.investigando`.
3. Com o app fechado: duplo clique no arquivo. O app abre já com o projeto carregado (o caminho espera a interface ficar pronta).
4. Com o app aberto e sem alterações: duplo clique em outro `.investigando` (ou arraste-o sobre o ícone do Dock/app). O projeto troca direto.
5. Com alterações não salvas: o app pergunta "Abrir outro projeto mesmo assim?" antes de trocar; Cancelar mantém o projeto atual.
6. Arquivo inválido ou danificado: aparece a mesma mensagem de erro do "Abrir".

No Windows/Linux o arquivo chega como argumento de linha de comando: `investigando caminho/projeto.investigando`. No `tauri dev` isso não vale para o Finder (o evento de abertura só existe no app empacotado).
