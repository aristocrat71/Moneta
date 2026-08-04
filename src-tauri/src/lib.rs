mod fs;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            fs::ensure_layout()?;
            watcher::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fs::library_scan,
            fs::read_notebook,
            fs::write_notebook,
            fs::delete_notebook,
            fs::duplicate_notebook,
            fs::read_library,
            fs::write_library,
            fs::read_settings,
            fs::write_settings,
            fs::write_thumbnail,
            fs::read_thumbnails,
            fs::export_file,
            fs::storage_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
