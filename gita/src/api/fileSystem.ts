import { invoke } from '@tauri-apps/api/core';
import { Note, NoteMetadata } from '../types';

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

// Read a note content
export async function readNoteContent(path: string): Promise<Note> {
  return invoke('read_note_content', { path });
}

// Write a note content
export async function writeNoteContent(path: string, content: Note): Promise<void> {
  return invoke('write_note_content', { path, content });
}

// Create a new note
export async function createNote(title: string, content: Note): Promise<Note> {
  return invoke('create_note', { title, content });
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

