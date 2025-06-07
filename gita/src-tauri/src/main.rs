#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod file_system;
mod audio;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use rusqlite::Connection;

// Define a struct to hold the database connection
struct AppState {
    db_conn: Mutex<Connection>,
    notes_dir: Mutex<PathBuf>,
    audio_dir: Mutex<PathBuf>,
}

// Initialize the app state
fn init_app_state(app_handle: &AppHandle) -> Result<AppState, Box<dyn std::error::Error>> {
    // Get the app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    
    // Create the app data directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir)?;
    
    // Initialize the database
    let db_conn = file_system::init_database(&app_data_dir)?;
    
    // Set default notes and audio directories
    let notes_dir = app_data_dir.join("notes");
    let audio_dir = app_data_dir.join("audio");
    
    // Create the directories if they don't exist
    std::fs::create_dir_all(&notes_dir)?;
    std::fs::create_dir_all(&audio_dir)?;
    
    Ok(AppState {
        db_conn: Mutex::new(db_conn),
        notes_dir: Mutex::new(notes_dir),
        audio_dir: Mutex::new(audio_dir),
    })
}

// Command to get the notes directory
#[tauri::command]
fn get_notes_directory(state: State<AppState>) -> Result<String, String> {
    let notes_dir = state.notes_dir.lock().map_err(|_| "Failed to acquire notes directory lock".to_string())?;
    notes_dir.to_str().map(|s| s.to_string()).ok_or_else(|| "Notes directory path is not valid UTF-8".to_string())
}

// Command to set the notes directory
#[tauri::command]
fn set_notes_directory(state: State<AppState>, path: &str) -> Result<(), String> {
    let path = PathBuf::from(path);
    
    // Check if the directory exists
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    // Check if the directory is readable
    if std::fs::metadata(&path).map_err(|e| e.to_string())?.permissions().readonly() {
        return Err("Directory is not writable".to_string());
    }
    
    // Update the notes directory
    let mut notes_dir = state.notes_dir.lock().map_err(|_| "Failed to acquire notes directory lock".to_string())?;
    *notes_dir = path;
    
    Ok(())
}

// Command to get the audio directory
#[tauri::command]
fn get_audio_directory(state: State<AppState>) -> Result<String, String> {
    let audio_dir = state.audio_dir.lock().map_err(|_| "Failed to acquire audio directory lock".to_string())?;
    audio_dir.to_str().map(|s| s.to_string()).ok_or_else(|| "Audio directory path is not valid UTF-8".to_string())
}

// Command to set the audio directory
#[tauri::command]
fn set_audio_directory(state: State<AppState>, path: &str) -> Result<(), String> {
    let path = PathBuf::from(path);
    
    // Check if the directory exists
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    // Check if the directory is readable
    if std::fs::metadata(&path).map_err(|e| e.to_string())?.permissions().readonly() {
        return Err("Directory is not writable".to_string());
    }
    
    // Update the audio directory
    let mut audio_dir = state.audio_dir.lock().map_err(|_| "Failed to acquire audio directory lock".to_string())?;
    *audio_dir = path;
    
    Ok(())
}

// Command to get all notes
#[tauri::command]
fn get_all_notes(state: State<AppState>) -> Result<Vec<file_system::NoteMetadata>, String> {
    let notes_dir_pathbuf = state.notes_dir.lock().map_err(|_| "Failed to acquire notes directory lock".to_string())?;
    let notes_dir_str = notes_dir_pathbuf.to_str().ok_or_else(|| "Notes directory path is not valid UTF-8".to_string())?;
    file_system::get_all_notes(notes_dir_str)
}

// Command to search notes
#[tauri::command]
fn search_notes(state: State<AppState>, query: &str) -> Result<Vec<file_system::NoteMetadata>, String> {
    let notes_dir_pathbuf = state.notes_dir.lock().map_err(|_| "Failed to acquire notes directory lock".to_string())?;
    let notes_dir_str = notes_dir_pathbuf.to_str().ok_or_else(|| "Notes directory path is not valid UTF-8".to_string())?;
    file_system::search_notes(notes_dir_str, query)
}

// Command to read a markdown file
#[tauri::command]
fn read_markdown_file(path: &str) -> Result<file_system::Note, String> {
    file_system::read_markdown_file(path)
}

// Command to write a markdown file
#[tauri::command]
fn write_markdown_file(path: &str, content: &str) -> Result<(), String> {
    file_system::write_markdown_file(path, content)
}

// Command to create a new note
#[tauri::command]
fn create_note(state: State<AppState>, title: &str, content: &str) -> Result<file_system::Note, String> {
    let notes_dir_pathbuf = state.notes_dir.lock().map_err(|_| "Failed to acquire notes directory lock".to_string())?;
    let notes_dir_str = notes_dir_pathbuf.to_str().ok_or_else(|| "Notes directory path is not valid UTF-8".to_string())?;
    file_system::create_note(notes_dir_str, title, content)
}

// Command to create a daily note
#[tauri::command]
fn create_daily_note(state: State<AppState>) -> Result<file_system::Note, String> {
    let notes_dir_pathbuf = state.notes_dir.lock().map_err(|_| "Failed to acquire notes directory lock".to_string())?;
    let notes_dir_str = notes_dir_pathbuf.to_str().ok_or_else(|| "Notes directory path is not valid UTF-8".to_string())?;
    file_system::create_daily_note(notes_dir_str)
}

// Command to find backlinks for a note
#[tauri::command]
fn find_backlinks(state: State<AppState>, note_id: &str) -> Result<Vec<file_system::NoteMetadata>, String> {
    let notes_dir_pathbuf = state.notes_dir.lock().map_err(|_| "Failed to acquire notes directory lock".to_string())?;
    let notes_dir_str = notes_dir_pathbuf.to_str().ok_or_else(|| "Notes directory path is not valid UTF-8".to_string())?;
    file_system::find_backlinks(notes_dir_str, note_id)
}

// Command to start recording
#[tauri::command]
fn start_recording(state: State<AppState>, note_id: &str, recording_id: &str) -> Result<String, String> {
    let audio_dir_pathbuf = state.audio_dir.lock().map_err(|_| "Failed to acquire audio directory lock".to_string())?;
    let audio_dir_str = audio_dir_pathbuf.to_str().ok_or_else(|| "Audio directory path is not valid UTF-8".to_string())?;
    audio::start_recording(note_id, recording_id, audio_dir_str)
}

// Command to stop recording
#[tauri::command]
fn stop_recording(state: State<AppState>, recording_id: &str) -> Result<audio::AudioRecording, String> {
    let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    audio::stop_recording(recording_id, &db_conn)
}

// Command to get audio recordings for a note
#[tauri::command]
fn get_audio_recordings(state: State<AppState>, note_id: &str) -> Result<Vec<audio::AudioRecording>, String> {
    let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    audio::get_audio_recordings(note_id, &db_conn)
}

// Command to get audio block references for a recording
#[tauri::command]
fn get_audio_block_references(state: State<AppState>, recording_id: &str) -> Result<Vec<audio::AudioBlockReference>, String> {
    let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    audio::get_audio_block_references(recording_id, &db_conn)
}

// Command to create an audio block reference
#[tauri::command]
fn create_audio_block_reference(
    state: State<AppState>,
    recording_id: &str,
    block_id: &str,
    audio_offset_ms: u64
) -> Result<audio::AudioBlockReference, String> {
    let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    audio::create_audio_block_reference(recording_id, block_id, audio_offset_ms, &db_conn)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize the app state
            let app_state = init_app_state(&app.app_handle())?;
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_notes_directory,
            set_notes_directory,
            get_audio_directory,
            set_audio_directory,
            get_all_notes,
            search_notes,
            read_markdown_file,
            write_markdown_file,
            create_note,
            create_daily_note,
            find_backlinks,
            start_recording,
            stop_recording,
            get_audio_recordings,
            get_audio_block_references,
            create_audio_block_reference,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

