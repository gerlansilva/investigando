# Instalar o Investigando

Há instaladores para **Mac** e **Windows**, gerados automaticamente pelo GitHub.

## Onde baixar

1. Abra o repositório → aba **Actions** → fluxo **Instaladores** → **Run workflow** (ou crie uma tag `v0.1.0` para gerar um *release* em rascunho).
2. Ao terminar, baixe em **Artifacts**:
   - `Investigando-macOS` → arquivo `.dmg` (Mac, Intel e Apple Silicon)
   - `Investigando-Windows` → `.exe` (instalador) e `.msi`

## Mac

1. Abra o `.dmg` e arraste **Investigando** para **Aplicativos**.
2. O app não é assinado. Na primeira vez, clique com o botão direito → **Abrir** → **Abrir**.
3. Se o Mac disser que o app está "danificado", rode no Terminal:
   `xattr -dr com.apple.quarantine /Applications/Investigando.app`

## Windows

1. Execute o `.exe` (ou o `.msi`).
2. O SmartScreen pode avisar sobre editor desconhecido: clique em **Mais informações → Executar assim mesmo**.
3. Siga o instalador. O atalho aparece no menu Iniciar.

## Compilar localmente

Requisitos: Node 22+, Rust (rustup) e as dependências do Tauri para o seu sistema.

```bash
npm ci
npm test
npm run tauri build
```

Mac: os detalhes estão em [EMPACOTAR-MAC.md](EMPACOTAR-MAC.md).

## Primeira execução do fluxo

O código Rust ainda não foi compilado fora do GitHub. Se o fluxo falhar, copie o erro do log da etapa que falhou e corrija a partir dele.
