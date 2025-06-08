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

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use serde_json::Value;
use uuid::Uuid;
use crate::page_handler::Page as DalPage;
use crate::audio_handler::AudioRecording as DalAudioRecording;
use crate::audio_handler::AudioTimestamp as DalAudioTimestamp;
use crate::link_handler::BlockReference as DalBlockReference; // For the new command

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct CommandAudioRecording {
    id: String,
    page_id: Option<String>,
    file_path: String,
    mime_type: Option<String>,
    duration_ms: Option<i32>,
    created_at: String,
}

impl From<DalAudioRecording> for CommandAudioRecording {
    fn from(ar: DalAudioRecording) -> Self {
        CommandAudioRecording {
            id: ar.id.to_string(),
            page_id: ar.page_id.map(|uuid| uuid.to_string()),
            file_path: ar.file_path,
            mime_type: ar.mime_type,
            duration_ms: ar.duration_ms,
            created_at: ar.created_at.to_rfc3339(),
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct CommandAudioTimestamp {
    id: String,
    audio_recording_id: String,
    block_id: String,
    timestamp_ms: i32,
    created_at: String,
}

impl From<DalAudioTimestamp> for CommandAudioTimestamp {
    fn from(at: DalAudioTimestamp) -> Self {
        CommandAudioTimestamp {
            id: at.id.to_string(),
            audio_recording_id: at.audio_recording_id.to_string(),
            block_id: at.block_id.to_string(),
            timestamp_ms: at.timestamp_ms,
            created_at: at.created_at.to_rfc3339(),
        }
    }
}

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

// New struct for Block References to be sent over Tauri command
#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct CommandBlockReference {
    id: String,
    referencing_page_id: String,
    referencing_block_id: String,
    referenced_page_id: String,
    referenced_block_id: String,
    created_at: String,
}

// Conversion from the DAL struct to the Command struct
impl From<DalBlockReference> for CommandBlockReference {
    fn from(br: DalBlockReference) -> Self {
        CommandBlockReference {
            id: br.id.to_string(),
            referencing_page_id: br.referencing_page_id.to_string(),
            referencing_block_id: br.referencing_block_id.to_string(),
            referenced_page_id: br.referenced_page_id.to_string(),
            referenced_block_id: br.referenced_block_id.to_string(),
            created_at: br.created_at.to_rfc3339(),
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
        raw_markdown.as_deref().map(Some), // If raw_markdown is Some(String), pass Some(Some(string_slice)). If None, pass None.
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
async fn start_recording(
    state: State<'_, AppState>,
    page_id: Option<String>,
    recording_id: String,
) -> Result<String, String> {
    let audio_dir_pathbuf = state.audio_dir.lock().map_err(|_| "Failed to acquire audio directory lock".to_string())?;
    let audio_dir_str = audio_dir_pathbuf.to_str().ok_or_else(|| "Audio directory path is not valid UTF-8".to_string())?;

    audio::start_recording(
        page_id.as_deref(),
        &recording_id,
        audio_dir_str,
    )
}

// Command to stop recording
#[tauri::command]
async fn stop_recording(state: State<'_, AppState>, recording_id: String) -> Result<CommandAudioRecording, String> {
    let rec_uuid = Uuid::parse_str(&recording_id).map_err(|e| format!("Invalid recording ID: {}", e))?;

    let dal_audio_recording = audio::stop_recording(rec_uuid.to_string(), &state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(CommandAudioRecording::from(dal_audio_recording))
}

// Command to get audio recordings for a note
#[tauri::command]
async fn get_audio_recordings(state: State<'_, AppState>, page_id: String) -> Result<Vec<CommandAudioRecording>, String> {
    let page_uuid = Uuid::parse_str(&page_id).map_err(|e| format!("Invalid page ID format: {}", e))?;
    let recordings = audio_handler::get_audio_recordings_for_page(&state.pool, page_uuid)
        .await
        .map_err(|e| e.to_string())?;
    let result: Vec<CommandAudioRecording> = recordings.into_iter().map(CommandAudioRecording::from).collect();
    Ok(result)
}

// New get_audio_timestamps_for_recording function (replaces get_audio_block_references)
#[tauri::command]
async fn get_audio_timestamps_for_recording(state: State<'_, AppState>, recording_id: String) -> Result<Vec<CommandAudioTimestamp>, String> {
    let recording_uuid = Uuid::parse_str(&recording_id).map_err(|e| format!("Invalid recording ID format: {}", e))?;
    let timestamps = audio_handler::get_audio_timestamps_for_recording(&state.pool, recording_uuid)
        .await
        .map_err(|e| e.to_string())?;
    let result: Vec<CommandAudioTimestamp> = timestamps.into_iter().map(CommandAudioTimestamp::from).collect();
    Ok(result)
}

// New add_audio_timestamp function (replaces create_audio_block_reference)
#[tauri::command]
async fn add_audio_timestamp(
    state: State<'_, AppState>,
    audio_recording_id: String,
    block_id: String,
    timestamp_ms: i32,
) -> Result<CommandAudioTimestamp, String> {
    let recording_uuid = Uuid::parse_str(&audio_recording_id).map_err(|e| format!("Invalid recording ID format: {}", e))?;
    let block_uuid = Uuid::parse_str(&block_id).map_err(|e| format!("Invalid block ID format: {}", e))?;

    let new_timestamp_id = audio_handler::add_audio_timestamp_to_block(
        &state.pool,
        recording_uuid,
        block_uuid,
        timestamp_ms,
    )
    .await
    .map_err(|e| e.to_string())?;

    // To return the full CommandAudioTimestamp, we need to fetch it.
    // Assuming add_audio_timestamp_to_block returns the ID of the new timestamp.
    // A more direct way would be if add_audio_timestamp_to_block returned the created object.
    // For now, let's try to find it among all timestamps for that recording.
    // This is not ideal if there are many timestamps.
    // A dedicated get_audio_timestamp(id) would be better.
    // For the sake of this refactor, we'll fetch all for the recording and find by ID.
    let timestamps_for_recording = audio_handler::get_audio_timestamps_for_recording(&state.pool, recording_uuid)
        .await
        .map_err(|e| e.to_string())?;

    let created_timestamp = timestamps_for_recording.into_iter().find(|ts| ts.id == new_timestamp_id)
        .ok_or_else(|| format!("Failed to retrieve newly created audio timestamp with id {}", new_timestamp_id))?;

    Ok(CommandAudioTimestamp::from(created_timestamp))
}

// Command to get references to a specific block
#[tauri::command]
async fn get_references_for_block(state: State<'_, AppState>, block_id: String) -> Result<Vec<CommandBlockReference>, String> {
    let block_uuid = Uuid::parse_str(&block_id).map_err(|e| format!("Invalid block ID format: {}", e))?;

    let references = link_handler::get_block_references_to_block(&state.pool, block_uuid)
        .await
        .map_err(|e| e.to_string())?;

    let command_references = references.into_iter().map(CommandBlockReference::from).collect();
    Ok(command_references)
}


#[tokio::main]
async fn main() {
    tauri::Builder::default()
    .setup(|app| async move {
        let app_state = init_app_state(&app.app_handle()).await?;
        app.manage(app_state);
        Ok::<(), Box<dyn std::error::Error + Send + Sync + 'static>>(())
        })
        .invoke_handler(tauri::generate_handler![
            get_notes_directory,
            set_notes_directory,
            get_audio_directory,
            set_audio_directory,
            get_all_notes,
            search_notes,
            get_page_details,
            update_page_content,
            create_note,
            create_daily_note,
            delete_note,
            find_backlinks,
            start_recording,
            stop_recording,
            get_audio_recordings,
            get_audio_timestamps_for_recording, // Renamed
            add_audio_timestamp, // Renamed
            get_references_for_block
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

