import { invoke } from '@tauri-apps/api/core';
import { Note, NoteMetadata, BlockReference } from '../types'; // Added BlockReference

// Get the notes directory
export async function getNotesDirectory(): Promise<string> {
  return invoke('get_notes_directory');
}

// Set the notes directory
export async function setNotesDirectory(path: string): Promise<void> {
  return invoke('set_notes_directory', { path });
}

// Get the audio directory
export async function getAudioDirectory(): Promise<string> {
  return invoke('get_audio_directory');
}

// Set the audio directory
export async function setAudioDirectory(path: string): Promise<void> {
  return invoke('set_audio_directory', { path });
}

// Get all notes
export async function getAllNotes(): Promise<NoteMetadata[]> {
  return invoke('get_all_notes');
}

// Search notes
export async function searchNotes(query: string): Promise<NoteMetadata[]> {
  return invoke('search_notes', { query });
}

// Get full page details (replaces readNoteContent)
export async function getPageDetails(noteId: string): Promise<Note> {
  // Backend returns CommandPage which should map to the updated Note type
  return invoke('get_page_details', { id: noteId });
}

// Update page content (replaces writeNoteContent)
export async function updatePageContent(
  noteId: string,
  title: string,
  contentJsonString: string, // Lexical JSON state as a string
  rawMarkdown?: string
): Promise<boolean> {
  try {
    const contentJson = JSON.parse(contentJsonString); // Parse string to JSON object
    return invoke('update_page_content', {
      id: noteId,
      title,
      contentJson, // Pass the parsed JSON object
      rawMarkdown,
    });
  } catch (error) {
    console.error("Error parsing contentJson string before sending to backend:", error);
    // Propagate the error or return false, depending on desired error handling
    // For now, let's rethrow, assuming the caller handles it or it bubbles up.
    // Alternatively, return Promise.reject(error) or a custom error structure.
    throw new Error("Invalid content_json format.");
  }
}

// Create a new note
export async function createNote(title: string, initialRawMarkdown: string): Promise<Note> {
  // Backend create_note expects title and initial raw markdown (content).
  // It returns a CommandPage which should map to the updated Note type.
  return invoke('create_note', { title, content: initialRawMarkdown });
}

// Create a daily note
export async function createDailyNote(): Promise<Note> {
  return invoke('create_daily_note');
}

// Delete a note
export async function deleteNote(noteId: string): Promise<void> {
  return invoke('delete_note', { note_id: noteId });
}

// Find backlinks for a note
export async function findBacklinks(noteId: string): Promise<NoteMetadata[]> {
  return invoke('find_backlinks', { note_id: noteId });
}

// Get references for a block
export async function getReferencesForBlock(blockId: string): Promise<BlockReference[]> {
  return invoke('get_references_for_block', { blockId });
}
