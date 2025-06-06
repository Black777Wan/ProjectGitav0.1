use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result as SqliteResult};
use walkdir::WalkDir;
use regex::Regex;
use serde_yaml;

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
    for entry in WalkDir::new(notes_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // Skip directories and non-markdown files
        if path.is_dir() || path.extension().map_or(true, |ext| ext != "md") {
            continue;
        }
        
        // Read the file and extract metadata
        match read_markdown_file(path.to_str().unwrap()) {
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
    // Read the file content
    let mut file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut content = String::new();
    file.read_to_string(&mut content).map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Extract front matter and content
    let (front_matter, content) = extract_front_matter(&content);
    
    // Parse front matter
    let front_matter: NoteFrontMatter = front_matter
        .map(|fm| serde_yaml::from_str(&fm).unwrap_or_else(|_| NoteFrontMatter {
            id: None,
            title: None,
            created_at: None,
            updated_at: None,
            tags: None,
        }))
        .unwrap_or_else(|| NoteFrontMatter {
            id: None,
            title: None,
            created_at: None,
            updated_at: None,
            tags: None,
        });
    
    // Get file metadata
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let created_at = metadata.created()
        .map(|time| {
            let datetime: DateTime<Utc> = time.into();
            datetime.format("%Y-%m-%dT%H:%M:%SZ").to_string()
        })
        .unwrap_or_else(|_| Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
    
    let updated_at = metadata.modified()
        .map(|time| {
            let datetime: DateTime<Utc> = time.into();
            datetime.format("%Y-%m-%dT%H:%M:%SZ").to_string()
        })
        .unwrap_or_else(|_| Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
    
    // Extract title from content if not in front matter
    let title = front_matter.title.unwrap_or_else(|| {
        // Try to extract title from first heading
        let re = Regex::new(r"^#\s+(.+)$").unwrap();
        content.lines()
            .find_map(|line| re.captures(line).map(|cap| cap[1].to_string()))
            .unwrap_or_else(|| {
                // Use filename as title if no heading found
                Path::new(path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Untitled Note")
                    .to_string()
            })
    });
    
    // Generate ID if not in front matter
    let id = front_matter.id.unwrap_or_else(|| {
        format!("note_{}", chrono::Utc::now().timestamp_millis())
    });
    
    // Use front matter dates if available
    let created_at = front_matter.created_at.unwrap_or(created_at);
    let updated_at = front_matter.updated_at.unwrap_or(updated_at);
    
    // Use front matter tags if available
    let tags = front_matter.tags.unwrap_or_else(Vec::new);
    
    Ok(Note {
        id,
        title,
        path: path.to_string(),
        content: content.to_string(),
        created_at,
        updated_at,
        tags,
    })
}

// Write a markdown file
pub fn write_markdown_file(path: &str, content: &str) -> Result<(), String> {
    // Extract front matter and content
    let (front_matter, content_without_fm) = extract_front_matter(content);
    
    // Parse front matter or create new one
    let mut front_matter_data: NoteFrontMatter = front_matter
        .map(|fm| serde_yaml::from_str(&fm).unwrap_or_else(|_| NoteFrontMatter {
            id: None,
            title: None,
            created_at: None,
            updated_at: None,
            tags: None,
        }))
        .unwrap_or_else(|| NoteFrontMatter {
            id: None,
            title: None,
            created_at: None,
            updated_at: None,
            tags: None,
        });
    
    // Update the updated_at timestamp
    front_matter_data.updated_at = Some(Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
    
    // Extract title from content if not in front matter
    if front_matter_data.title.is_none() {
        let re = Regex::new(r"^#\s+(.+)$").unwrap();
        front_matter_data.title = content_without_fm.lines()
            .find_map(|line| re.captures(line).map(|cap| cap[1].to_string()));
    }
    
    // Generate ID if not in front matter
    if front_matter_data.id.is_none() {
        front_matter_data.id = Some(format!("note_{}", chrono::Utc::now().timestamp_millis()));
    }
    
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
    
    // Create front matter
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let front_matter = NoteFrontMatter {
        id: Some(id.clone()),
        title: Some(title.to_string()),
        created_at: Some(now.clone()),
        updated_at: Some(now.clone()),
        tags: Some(Vec::new()),
    };
    
    // Serialize front matter
    let front_matter_yaml = serde_yaml::to_string(&front_matter)
        .map_err(|e| format!("Failed to serialize front matter: {}", e))?;
    
    // Combine front matter and content
    let full_content = format!("---\n{}---\n\n{}", front_matter_yaml, content);
    
    // Write to file
    let mut file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(full_content.as_bytes()).map_err(|e| format!("Failed to write to file: {}", e))?;
    
    Ok(Note {
        id,
        title: title.to_string(),
        path: path.to_str().unwrap().to_string(),
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
        return read_markdown_file(path.to_str().unwrap());
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
    let mut file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(full_content.as_bytes()).map_err(|e| format!("Failed to write to file: {}", e))?;
    
    Ok(Note {
        id,
        title,
        path: path.to_str().unwrap().to_string(),
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
    // Check if the content starts with front matter delimiters
    if content.starts_with("---") {
        // Find the end of the front matter
        if let Some(end_index) = content[3..].find("---") {
            let front_matter = &content[3..end_index + 3];
            let remaining_content = &content[end_index + 6..]; // Skip the second "---" and the following newline
            return (Some(front_matter.to_string()), remaining_content);
        }
    }
    
    // No front matter found
    (None, content)
}

