use tauri::{Emitter, Manager};

#[tauri::command]
fn get_cli_file_path() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let path = &args[1];
        if std::path::Path::new(path).exists() {
            return Some(path.clone());
        }
    }
    None
}

#[tauri::command]
fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "Unknown".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 두 번째 인스턴스 실행 시도 시 → 첫 인스턴스 포커스 + CLI args를 frontend로 emit
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if args.len() > 1 {
                let path = &args[1];
                if std::path::Path::new(path).exists() {
                    let _ = app.emit("open-file", path.clone());
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_cli_file_path, get_hostname])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            // Set window title based on CLI arg
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let path = std::path::Path::new(&args[1]);
                if let Some(name) = path.file_name() {
                    let _ = window.set_title(&format!("{} - BluePad", name.to_string_lossy()));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
