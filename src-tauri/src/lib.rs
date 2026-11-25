use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_fs::FsExt;

const EXTENSAO: &str = "investigando";
const EVENTO: &str = "abrir-arquivo";

/// Arquivos recebidos antes de a interface estar pronta, e se ela já avisou que está.
#[derive(Default)]
struct Abertura {
    pendentes: Vec<String>,
    pronto: bool,
}

type Estado = Mutex<Abertura>;

fn eh_projeto(caminho: &Path) -> bool {
    caminho
        .extension()
        .and_then(|e| e.to_str())
        .map_or(false, |e| e.eq_ignore_ascii_case(EXTENSAO))
}

/// Libera a leitura do arquivo (escopo só deste caminho) e entrega à interface:
/// emite o evento se ela já está pronta; senão guarda para `interface_pronta`.
fn receber(app: &AppHandle, caminho: PathBuf) {
    if !eh_projeto(&caminho) || !caminho.is_file() {
        return;
    }
    let _ = app.fs_scope().allow_file(&caminho);
    let texto = caminho.to_string_lossy().into_owned();
    let estado = app.state::<Estado>();
    let mut a = estado.lock().unwrap();
    if a.pronto {
        drop(a);
        let _ = app.emit(EVENTO, texto);
    } else {
        a.pendentes.push(texto);
    }
}

/// A interface chama ao começar a escutar o evento; devolve o que chegou antes.
#[tauri::command]
fn interface_pronta(estado: tauri::State<'_, Estado>) -> Vec<String> {
    let mut a = estado.lock().unwrap();
    a.pronto = true;
    std::mem::take(&mut a.pendentes)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Estado::default())
        .invoke_handler(tauri::generate_handler![interface_pronta])
        .setup(|app| {
            // Windows/Linux: o arquivo vem como argumento de linha de comando (duplo clique / arrastar no ícone).
            #[cfg(not(target_os = "macos"))]
            for arg in std::env::args_os().skip(1) {
                receber(app.handle(), PathBuf::from(arg));
            }
            let _ = app;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao construir o Investigando");

    app.run(|app, evento| {
        // macOS: o Finder entrega o arquivo por evento (duplo clique ou arrastar sobre o ícone).
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &evento {
            for url in urls {
                if let Ok(caminho) = url.to_file_path() {
                    receber(app, caminho);
                }
            }
        }
        let _ = (app, evento);
    });
}
