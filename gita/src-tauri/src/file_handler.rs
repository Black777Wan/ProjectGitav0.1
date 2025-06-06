use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    path: String,
    name: String,
    is_directory: bool,
    children: Option<Vec<FileInfo>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BacklinkInfo {
    file_path: String,
    file_name: String,
    context: String,
}

#[tauri::command]
pub fn get_all_notes(vault_path: String) -> Result<Vec<FileInfo>, String> {
    let path = Path::new(&vault_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", vault_path));
    }

    let mut result = Vec::new();
    scan_directory(&path, &mut result).map_err(|e| e.to_string())?;
    Ok(result)
}

fn scan_directory(dir_path: &Path, result: &mut Vec<FileInfo>) -> std::io::Result<()> {
    if dir_path.is_dir() {
        for entry in fs::read_dir(dir_path)? {
            let entry = entry?;
            let path = entry.path();
            let name = path.file_name().unwrap().to_string_lossy().to_string();
            
            // Skip hidden files and directories
            if name.starts_with('.') {
                continue;
            }
            
            if path.is_dir() {
                let mut children = Vec::new();
                scan_directory(&path, &mut children)?;
                result.push(FileInfo {
                    path: path.to_string_lossy().to_string(),
                    name,
                    is_directory: true,
                    children: Some(children),
                });
            } else if path.extension().map_or(false, |ext| ext == "md") {
                result.push(FileInfo {
                    path: path.to_string_lossy().to_string(),
                    name,
                    is_directory: false,
                    children: None,
                });
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn read_note_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_note_content(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_daily_note(vault_path: String) -> Result<String, String> {
    let today = Local::now();
    let file_name = format!("{}.md", today.format("%Y-%m-%d"));
    let file_path = Path::new(&vault_path).join(&file_name);
    
    if !file_path.exists() {
        let mut file = fs::File::create(&file_path)
            .map_err(|e| e.to_string())?;
            
        let header = format!("# {}\n\n", today.format("%Y-%m-%d"));
        file.write_all(header.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn find_backlinks(page_name: String, vault_path: String) -> Result<Vec<BacklinkInfo>, String> {
    let path = Path::new(&vault_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", vault_path));
    }
    
    let link_pattern = format!("[[{}]]", page_name);
    let mut backlinks = Vec::new();
    
    find_backlinks_in_dir(path, &link_pattern, &mut backlinks)
        .map_err(|e| e.to_string())?;
    
    Ok(backlinks)
}

fn find_backlinks_in_dir(dir_path: &Path, link_pattern: &str, backlinks: &mut Vec<BacklinkInfo>) -> std::io::Result<()> {
    if dir_path.is_dir() {
        for entry in fs::read_dir(dir_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                find_backlinks_in_dir(&path, link_pattern, backlinks)?;
            } else if path.extension().map_or(false, |ext| ext == "md") {
                let content = fs::read_to_string(&path)?;
                
                if content.contains(link_pattern) {
                    // Find a snippet of context around the link
                    let mut context = String::new();
                    for line in content.lines() {
                        if line.contains(link_pattern) {
                            context = line.trim().to_string();
                            break;
                        }
                    }
                    
                    backlinks.push(BacklinkInfo {
                        file_path: path.to_string_lossy().to_string(),
                        file_name: path.file_name().unwrap().to_string_lossy().to_string(),
                        context,
                    });
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn generate_block_id() -> String {
    Uuid::new_v4().to_string()
}
