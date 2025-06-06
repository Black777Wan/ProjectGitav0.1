// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod file_handler;
mod audio_handler;

// Import lazy_static for global state
#[macro_use]
extern crate lazy_static;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // File system commands
            file_handler::get_all_notes,
            file_handler::read_note_content,
            file_handler::write_note_content,
            file_handler::create_daily_note,
            file_handler::find_backlinks,
            file_handler::generate_block_id,
            
            // Audio commands
            audio_handler::list_audio_devices,
            audio_handler::start_recording,
            audio_handler::stop_recording,
            audio_handler::get_recording_timestamp_ms,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
