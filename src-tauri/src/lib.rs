use tauri::Manager;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_cli_file_path])
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
