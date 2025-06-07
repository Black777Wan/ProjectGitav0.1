use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::AppHandle;

use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_yaml;
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub id: String,
    pub title: String,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub path: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct NoteFrontMatter {
    id: Option<String>,
    title: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    tags: Option<Vec<String>>,
}

// Initialize the database
pub fn init_database(app_data_dir: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path = app_data_dir.join("obsidian_replica.db");
    let db_conn = Connection::open(&db_path)?;
    
    // Create tables if they don't exist
    db_conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    
    db_conn.execute(
        "CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )",
        [],
    )?;
    
    db_conn.execute(
        "CREATE TABLE IF NOT EXISTS note_tags (
            note_id TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (note_id, tag_id),
            FOREIGN KEY (note_id) REFERENCES notes (id),
            FOREIGN KEY (tag_id) REFERENCES tags (id)
        )",
        [],
    )?;
    
    db_conn.execute(
        "CREATE TABLE IF NOT EXISTS audio_recordings (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            recorded_at TEXT NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes (id)
        )",
        [],
    )?;
    
    db_conn.execute(
        "CREATE TABLE IF NOT EXISTS audio_block_references (
            id TEXT PRIMARY KEY,
            recording_id TEXT NOT NULL,
            block_id TEXT NOT NULL,
            audio_offset_ms INTEGER NOT NULL,
            FOREIGN KEY (recording_id) REFERENCES audio_recordings (id)
        )",
        [],
    )?;
    
    Ok(db_conn)
}

// Get all notes
pub fn get_all_notes(notes_dir: &str) -> Result<Vec<NoteMetadata>, String> {
    let mut notes = Vec::new();
    
    // Walk through the notes directory
    for entry_result in WalkDir::new(notes_dir).follow_links(true).into_iter() {
        let entry = match entry_result {
            Ok(e) => e,
            Err(err) => {
                eprintln!("Error walking directory: {}", err);
                continue;
            }
        };
        let path = entry.path();
        
        // Skip directories and non-markdown files
        if path.is_dir() || path.extension().map_or(true, |ext| ext != "md") {
            continue;
        }
        
        // Read the file and extract metadata
        let path_str = path.to_str().ok_or_else(|| format!("Invalid UTF-8 path in notes directory: {:?}", path))?;
        match read_markdown_file(path_str) {
            Ok(note) => {
                notes.push(NoteMetadata {
                    id: note.id,
                    title: note.title,
                    path: note.path,
                    created_at: note.created_at,
                    updated_at: note.updated_at,
                    tags: note.tags,
                });
            }
            Err(e) => {
                eprintln!("Error reading file {}: {}", path.display(), e);
            }
        }
    }
    
    // Sort notes by updated_at (newest first)
    notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    Ok(notes)
}

// Search notes
pub fn search_notes(notes_dir: &str, query: &str) -> Result<Vec<NoteMetadata>, String> {
    let all_notes = get_all_notes(notes_dir)?;
    
    // If query is empty, return all notes
    if query.trim().is_empty() {
        return Ok(all_notes);
    }
    
    // Convert query to lowercase for case-insensitive search
    let query_lower = query.to_lowercase();
    
    // Filter notes that match the query
    let filtered_notes = all_notes
        .into_iter()
        .filter(|note| {
            // Check if query matches title or tags
            note.title.to_lowercase().contains(&query_lower) ||
            note.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
        })
        .collect();
    
    Ok(filtered_notes)
}

// Read a markdown file
pub fn read_markdown_file(path: &str) -> Result<Note, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to open file {}: {}", path, e))?;
    let mut raw_content_string = String::new();
    file.read_to_string(&mut raw_content_string).map_err(|e| format!("Failed to read file {}: {}", path, e))?;

    let (fm_str_opt, content_after_fm) = extract_front_matter(&raw_content_string);

    let mut parsed_fm: NoteFrontMatter = fm_str_opt
        .map_or_else(
            || {
                // No front matter block found, use default.
                Ok(NoteFrontMatter::default())
            },
            |fm_str| {
                serde_yaml::from_str(&fm_str).map_err(|err| {
                    eprintln!("Failed to parse front matter YAML for file {}: {}. New front matter values will be used or generated.", path, err);
                    err // Return the error to indicate parsing failure
                })
            }
        )
        .unwrap_or_else(|_| NoteFrontMatter::default()); // If parsing fails (error returned from map_err), use default.

    // ID Handling: Use FM ID if present, otherwise generate a new one.
    let id = parsed_fm.id.take().unwrap_or_else(|| {
        let new_id = format!("note_{}", Uuid::new_v4());
        println!("INFO: Generated new ID {} for note {}", new_id, path);
        new_id
    });

    // File system metadata as a fallback for timestamps
    let fs_metadata_result = fs::metadata(path);

    // created_at Timestamp Prioritization
    let created_at_str = parsed_fm.created_at.take().map_or_else(
        || { // No created_at in FM
            fs_metadata_result.as_ref()
                .ok()
                .and_then(|meta| meta.created().ok())
                .map(|time| DateTime::<Utc>::from(time).format("%Y-%m-%dT%H:%M:%SZ").to_string())
                .unwrap_or_else(|| Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string())
        },
        |fm_created_at_str| { // created_at found in FM
            DateTime::parse_from_rfc3339(&fm_created_at_str)
                .map(|dt| dt.with_timezone(&Utc).format("%Y-%m-%dT%H:%M:%SZ").to_string())
                .unwrap_or_else(|parse_err| {
                    println!("WARN: Invalid created_at format in front matter for {}: '{}'. Error: {}. Falling back to FS metadata or now().", path, fm_created_at_str, parse_err);
                    fs_metadata_result.as_ref()
                        .ok()
                        .and_then(|meta| meta.created().ok())
                        .map(|time| DateTime::<Utc>::from(time).format("%Y-%m-%dT%H:%M:%SZ").to_string())
                        .unwrap_or_else(|| Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string())
                })
        }
    );

    // updated_at Timestamp Prioritization
    let updated_at_str = parsed_fm.updated_at.take().map_or_else(
        || { // No updated_at in FM
            fs_metadata_result.as_ref()
                .ok()
                .and_then(|meta| meta.modified().ok())
                .map(|time| DateTime::<Utc>::from(time).format("%Y-%m-%dT%H:%M:%SZ").to_string())
                .unwrap_or_else(|| Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string())
        },
        |fm_updated_at_str| { // updated_at found in FM
            DateTime::parse_from_rfc3339(&fm_updated_at_str)
                .map(|dt| dt.with_timezone(&Utc).format("%Y-%m-%dT%H:%M:%SZ").to_string())
                .unwrap_or_else(|parse_err| {
                    println!("WARN: Invalid updated_at format in front matter for {}: '{}'. Error: {}. Falling back to FS metadata or now().", path, fm_updated_at_str, parse_err);
                    fs_metadata_result.as_ref()
                        .ok()
                        .and_then(|meta| meta.modified().ok())
                        .map(|time| DateTime::<Utc>::from(time).format("%Y-%m-%dT%H:%M:%SZ").to_string())
                        .unwrap_or_else(|| Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string())
                })
        }
    );
    
    // Title Handling (Front Matter > H1 > Filename)
    let title = parsed_fm.title.take().unwrap_or_else(|| {
        let re = Regex::new(r"^#\s+(.+)$").unwrap();
        content_after_fm.lines()
            .find_map(|line| re.captures(line).map(|cap| cap[1].trim().to_string()))
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| {
                Path::new(path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "Untitled Note".to_string())
            })
    });
    
    // Tags Handling: Use FM tags if present, otherwise default to empty Vec.
    let tags = parsed_fm.tags.take().unwrap_or_else(Vec::new);
    
    Ok(Note {
        id,
        title,
        path: path.to_string(),
        content: content_after_fm.to_string(),
        created_at: created_at_str,
        updated_at: updated_at_str,
        tags,
    })
}

// Write a markdown file
pub fn write_markdown_file(path: &str, content: &str) -> Result<(), String> {
    let (fm_str_opt, content_without_fm) = extract_front_matter(content);

    let mut front_matter_data: NoteFrontMatter = fm_str_opt
        .map_or_else(
            || Ok(NoteFrontMatter::default()), // No FM block, start with default
            |fm_str| serde_yaml::from_str(&fm_str)
        )
        .unwrap_or_else(|err| {
            eprintln!("WARN: Failed to parse existing front matter for {}: {}. New front matter will be generated/augmented.", path, err);
            NoteFrontMatter::default()
        });
    
    // Augment Front Matter Data
    if front_matter_data.id.is_none() {
        front_matter_data.id = Some(format!("note_{}", Uuid::new_v4()));
         println!("INFO: Generated new ID {:?} for note being written to {}", front_matter_data.id.as_ref().unwrap(), path);
    }
    
    if front_matter_data.title.is_none() {
        let re = Regex::new(r"^#\s+(.+)$").unwrap();
        front_matter_data.title = content_without_fm.lines()
            .find_map(|line| re.captures(line).map(|cap| cap[1].trim().to_string()))
            .filter(|t| !t.is_empty());
    }

    if front_matter_data.created_at.is_none() {
        front_matter_data.created_at = Some(Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
    }

    // Ensure tags field is present (as `tags: []` if none were there)
    if front_matter_data.tags.is_none() {
        front_matter_data.tags = Some(Vec::new());
    }
    
    // Always update the updated_at timestamp
    front_matter_data.updated_at = Some(Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());

    // Serialize front matter
    let front_matter_yaml = serde_yaml::to_string(&front_matter_data)
        .map_err(|e| format!("Failed to serialize front matter: {}", e))?;
    
    // Combine front matter and content
    let full_content = format!("---\n{}---\n\n{}", front_matter_yaml, content_without_fm);
    
    // Write to file
    let mut file = File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(full_content.as_bytes()).map_err(|e| format!("Failed to write to file: {}", e))?;
    
    Ok(())
}

// Create a new note
pub fn create_note(notes_dir: &str, title: &str, content: &str) -> Result<Note, String> {
    // Generate a filename from the title
    let filename = title
        .to_lowercase()
        .replace(' ', "_")
        .replace(|c: char| !c.is_alphanumeric() && c != '_', "");
    
    // Generate a unique ID
    let id = format!("note_{}", chrono::Utc::now().timestamp_millis());
    
    // Create the file path
    let path = Path::new(notes_dir).join(format!("{}.md", filename));

    // Check if file already exists - using create_new later
    // if path.exists() {
    //     return Err(format!("Note with generated filename {:?} already exists. Please choose a different title.", path.file_name().unwrap_or_default()));
    // }
    
    // Create front matter
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let front_matter = NoteFrontMatter {
        id: Some(id.clone()),
        title: Some(title.to_string()),
        created_at: Some(now.clone()),
        updated_at: Some(now.clone()),
            tags: Some(Vec::new()), // Default to empty vec for new notes
    };
    
    // Serialize front matter
    let front_matter_yaml = serde_yaml::to_string(&front_matter)
        .map_err(|e| format!("Failed to serialize front matter: {}", e))?;
    
    // Combine front matter and content
    let full_content = format!("---\n{}---\n\n{}", front_matter_yaml, content);
    
    // Write to file using create_new to avoid overwriting
    let mut file = match File::create_new(&path) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            return Err(format!("Note with generated filename {:?} already exists. Please choose a different title or edit the existing note.", path.file_name().unwrap_or_default()));
        }
        Err(e) => return Err(format!("Failed to create file {:?}: {}", path, e)),
    };
    file.write_all(full_content.as_bytes()).map_err(|e| format!("Failed to write to file {:?}: {}", path, e))?;
    
    let path_str = path.to_str().ok_or_else(|| format!("Generated path for new note is not valid UTF-8: {:?}", path))?;

    Ok(Note {
        id,
        title: title.to_string(),
        path: path_str.to_string(),
        content: content.to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
    })
}

// Create a daily note
pub fn create_daily_note(notes_dir: &str) -> Result<Note, String> {
    // Generate the title and filename based on the current date
    let today = chrono::Local::now();
    let title = today.format("%Y-%m-%d").to_string();
    let filename = title.clone();
    
    // Check if the daily note already exists
    let path = Path::new(notes_dir).join(format!("{}.md", filename));
    if path.exists() {
        // If it exists, just read and return it
        let path_str = path.to_str().ok_or_else(|| format!("Daily note path is not valid UTF-8: {:?}", path))?;
        return read_markdown_file(path_str);
    }
    
    // Generate a unique ID
    let id = format!("daily_{}", today.format("%Y%m%d").to_string());
    
    // Create front matter
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let front_matter = NoteFrontMatter {
        id: Some(id.clone()),
        title: Some(title.clone()),
        created_at: Some(now.clone()),
        updated_at: Some(now.clone()),
        tags: Some(vec!["daily".to_string()]),
    };
    
    // Serialize front matter
    let front_matter_yaml = serde_yaml::to_string(&front_matter)
        .map_err(|e| format!("Failed to serialize front matter: {}", e))?;
    
    // Create content
    let content = format!("# {}\n\n## Notes\n\n## Tasks\n\n- [ ] \n\n## Journal\n\n", title);
    
    // Combine front matter and content
    let full_content = format!("---\n{}---\n\n{}", front_matter_yaml, content);
    
    // Write to file
    let mut file = File::create(&path).map_err(|e| format!("Failed to create file {:?}: {}", path, e))?;
    file.write_all(full_content.as_bytes()).map_err(|e| format!("Failed to write to file {:?}: {}", path, e))?;
    
    let path_str = path.to_str().ok_or_else(|| format!("Generated path for new daily note is not valid UTF-8: {:?}", path))?;

    Ok(Note {
        id,
        title,
        path: path_str.to_string(),
        content,
        created_at: now.clone(),
        updated_at: now,
        tags: vec!["daily".to_string()],
    })
}

// Find backlinks for a note
pub fn find_backlinks(notes_dir: &str, note_id: &str) -> Result<Vec<NoteMetadata>, String> {
    let all_notes = get_all_notes(notes_dir)?;
    let mut backlinks = Vec::new();
    
    // Find notes that link to the given note
    for note_meta in all_notes {
        // Read the note content
        let note = read_markdown_file(&note_meta.path)?;
        
        // Check if the note contains a link to the given note
        if note.content.contains(&format!("[[{}]]", note_id)) {
            backlinks.push(note_meta);
        }
    }
    
    Ok(backlinks)
}

// Helper function to extract front matter from markdown content
fn extract_front_matter(content: &str) -> (Option<String>, &str) {
    let front_matter_regex = Regex::new(r"^(?s)---\s*\n(.*?)\n---\s*\n?(.*)$").unwrap();
    if let Some(caps) = front_matter_regex.captures(content) {
        let fm_str = caps.get(1).map_or("", |m| m.as_str()).trim();
        let rest_content = caps.get(2).map_or("", |m| m.as_str());
        (Some(fm_str.to_string()), rest_content)
    } else {
        (None, content)
    }
}

// Implement Default for NoteFrontMatter
impl Default for NoteFrontMatter {
    fn default() -> Self {
        NoteFrontMatter {
            id: None,
            title: None,
            created_at: None,
            updated_at: None,
            tags: None,
        }
    }
}

