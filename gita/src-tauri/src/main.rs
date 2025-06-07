#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod file_system;
mod audio;
mod db;
pub mod dal_error;
pub mod page_handler;
pub mod block_handler;
pub mod audio_handler;
pub mod link_handler;
use crate::link_handler; // Added this line

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use serde_json::Value;
use uuid::Uuid;
use crate::page_handler::Page as DalPage;
use chrono::{DateTime, Utc};

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct CommandPageMetadata {
    id: String,
    title: String,
    created_at: String,
    updated_at: String,
}

impl From<DalPage> for CommandPageMetadata {
    fn from(page: DalPage) -> Self {
        CommandPageMetadata {
            id: page.id.to_string(),
            title: page.title,
            created_at: page.created_at.to_rfc3339(),
            updated_at: page.updated_at.to_rfc3339(),
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct CommandPage {
    id: String,
    title: String,
    content_json: Value,
    raw_markdown: Option<String>,
    created_at: String,
    updated_at: String,
}

impl From<DalPage> for CommandPage {
    fn from(page: DalPage) -> Self {
        CommandPage {
            id: page.id.to_string(),
            title: page.title,
            content_json: page.content_json,
            raw_markdown: page.raw_markdown,
            created_at: page.created_at.to_rfc3339(),
            updated_at: page.updated_at.to_rfc3339(),
        }
    }
}

// Define a struct to hold the database connection
struct AppState {
    pool: sqlx::PgPool,
    notes_dir: Mutex<PathBuf>,
    audio_dir: Mutex<PathBuf>,
}

// Initialize the app state
async fn init_app_state(app_handle: &AppHandle) -> Result<AppState, Box<dyn std::error::Error>> {
    // Get the app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    // Create the app data directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir)?;
    
    // Initialize the database
    let pool = db::init_pool().await?;
    
    // Set default notes and audio directories
    let notes_dir = app_data_dir.join("notes");
    let audio_dir = app_data_dir.join("audio");
    
    // Create the directories if they don't exist
    std::fs::create_dir_all(&notes_dir)?;
    std::fs::create_dir_all(&audio_dir)?;
    
    Ok(AppState {
        pool,
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
async fn get_all_notes(state: State<'_, AppState>) -> Result<Vec<CommandPageMetadata>, String> {
    let pages = page_handler::list_pages(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let result: Vec<CommandPageMetadata> = pages.into_iter().map(CommandPageMetadata::from).collect();
    Ok(result)
}

// Command to search notes
#[tauri::command]
async fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<CommandPageMetadata>, String> {
    let pages = page_handler::search_pages(&state.pool, &query)
        .await
        .map_err(|e| e.to_string())?;
    let result: Vec<CommandPageMetadata> = pages.into_iter().map(CommandPageMetadata::from).collect();
    Ok(result)
}

// New get_page_details function (replaces read_markdown_file)
#[tauri::command]
async fn get_page_details(state: State<'_, AppState>, id: String) -> Result<CommandPage, String> {
    let page_uuid = Uuid::parse_str(&id).map_err(|e| format!("Invalid page ID format: {}", e))?;
    let page = page_handler::get_page(&state.pool, page_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Page with ID {} not found", id))?;
    Ok(CommandPage::from(page))
}

// New update_page_content function (replaces write_markdown_file)
#[tauri::command]
async fn update_page_content(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    raw_markdown: Option<String>,
    content_json: Option<Value>, // Allow updating content_json too
) -> Result<bool, String> {
    let page_uuid = Uuid::parse_str(&id).map_err(|e| format!("Invalid page ID format: {}", e))?;

    // Prepare Option<&str> for title and raw_markdown
    let title_ref = title.as_deref();
    // let raw_markdown_ref = raw_markdown.as_deref();

    let updated = page_handler::update_page(
        &state.pool,
        page_uuid,
        title_ref,
        content_json, // Pass content_json directly
        raw_markdown.map(Some), // If raw_markdown is Some(String), pass Some(Some(string_slice)). If None, pass None.
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

// Command to create a new note
#[tauri::command]
async fn create_note(
    state: State<'_, AppState>,
    title: String, // Changed from &str to String
    content: String, // Changed from &str to String, assumed to be raw_markdown
) -> Result<CommandPage, String> {
    // For new notes, content_json could be empty or derived from raw_markdown.
    // Here, we'll use a default empty JSON object.
    // A more sophisticated approach might parse markdown to JSON.
    let default_content_json = serde_json::json!({});

    let new_page_id = page_handler::create_page(
        &state.pool,
        &title,
        default_content_json.clone(), // Pass clone here
        Some(&content),
    )
    .await
    .map_err(|e| e.to_string())?;

    // Fetch the created page to return its full details
    let new_page_details = page_handler::get_page(&state.pool, new_page_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to retrieve newly created page".to_string())?;

    Ok(CommandPage::from(new_page_details))
}

// Command to create a daily note
#[tauri::command]
async fn create_daily_note(state: State<'_, AppState>) -> Result<CommandPage, String> {
    let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Check if daily note already exists by title
    let existing_pages = page_handler::search_pages(&state.pool, &today_str)
        .await
        .map_err(|e| e.to_string())?;

    let mut daily_page: Option<DalPage> = None;
    for page in existing_pages {
        if page.title == today_str {
            daily_page = Some(page);
            break;
        }
    }

    if let Some(page) = daily_page {
        // If it exists, just return it
        Ok(CommandPage::from(page))
    } else {
        // If not, create it
        let default_content_json = serde_json::json!({
            "type": "doc",
            "content": [
                { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": &today_str }] },
                { "type": "paragraph" } // Add an empty paragraph
            ]
        });
        let initial_markdown = format!("# {}

", today_str);

        let new_page_id = page_handler::create_page(
            &state.pool,
            &today_str,
            default_content_json.clone(),
            Some(&initial_markdown),
        )
        .await
        .map_err(|e| e.to_string())?;

        let new_page_details = page_handler::get_page(&state.pool, new_page_id)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Failed to retrieve newly created daily page".to_string())?;

        Ok(CommandPage::from(new_page_details))
    }
}

// Command to delete a note
#[tauri::command]
async fn delete_note(state: State<'_, AppState>, note_id: String) -> Result<bool, String> {
    let page_uuid = Uuid::parse_str(&note_id).map_err(|e| format!("Invalid page ID format: {}", e))?;
    page_handler::delete_page(&state.pool, page_uuid)
        .await
        .map_err(|e| e.to_string())
}

// Command to find backlinks for a note
#[tauri::command]
async fn find_backlinks(state: State<'_, AppState>, note_id: String) -> Result<Vec<CommandPageMetadata>, String> {
    let page_uuid = Uuid::parse_str(&note_id).map_err(|e| format!("Invalid page ID format: {}", e))?;

    let links = link_handler::find_backlinks_for_page(&state.pool, page_uuid)
        .await
        .map_err(|e| e.to_string())?;

    let mut source_pages_metadata = Vec::new();
    for link in links {
        if let Ok(Some(page)) = page_handler::get_page(&state.pool, link.source_page_id).await {
            source_pages_metadata.push(CommandPageMetadata::from(page));
        }
        // Optionally log if a source page isn't found
    }
    Ok(source_pages_metadata)
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
    // let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    // audio::stop_recording(recording_id, &db_conn)
    Err("Database functionality is temporarily disabled".to_string())
}

// Command to get audio recordings for a note
#[tauri::command]
fn get_audio_recordings(state: State<AppState>, note_id: &str) -> Result<Vec<audio::AudioRecording>, String> {
    // let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    // audio::get_audio_recordings(note_id, &db_conn)
    Err("Database functionality is temporarily disabled".to_string())
}

// Command to get audio block references for a recording
#[tauri::command]
fn get_audio_block_references(state: State<AppState>, recording_id: &str) -> Result<Vec<audio::AudioBlockReference>, String> {
    // let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    // audio::get_audio_block_references(recording_id, &db_conn)
    Err("Database functionality is temporarily disabled".to_string())
}

// Command to create an audio block reference
#[tauri::command]
fn create_audio_block_reference(
    state: State<AppState>,
    recording_id: &str,
    block_id: &str,
    audio_offset_ms: u64
) -> Result<audio::AudioBlockReference, String> {
    // let db_conn = state.db_conn.lock().map_err(|_| "Failed to acquire database connection lock".to_string())?;
    // audio::create_audio_block_reference(recording_id, block_id, audio_offset_ms, &db_conn)
    Err("Database functionality is temporarily disabled".to_string())
}

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .setup(|app| {
            Box::pin(async move {
                let app_state = init_app_state(&app.app_handle()).await?;
                app.manage(app_state);
                Ok(())
            })
        })
        .invoke_handler(tauri::generate_handler![
            get_notes_directory,
            set_notes_directory,
            get_audio_directory,
            set_audio_directory,
            get_all_notes,      // Refactored
            search_notes,     // Refactored
            get_page_details, // New (was read_markdown_file)
            update_page_content, // New (was write_markdown_file)
            create_note,      // Refactored
            create_daily_note, // Refactored
            delete_note,      // Refactored
            find_backlinks,   // Refactored
            start_recording, // Keep existing audio commands
            stop_recording,
            get_audio_recordings,
            get_audio_block_references,
            create_audio_block_reference,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

