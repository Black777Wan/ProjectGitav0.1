import { invoke } from '@tauri-apps/api/core';
import {
  getNotesDirectory,
  setNotesDirectory,
  getAudioDirectory,
  setAudioDirectory,
  getAllNotes,
  searchNotes,
  readNoteContent,
  writeNoteContent,
  createNote,
  createDailyNote,
  deleteNote,
  findBacklinks,
} from './fileSystem'; // Adjust path as necessary
import { Note, NoteMetadata } from '../types'; // Adjust path as necessary

// Mock the tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

describe('fileSystem API', () => {
  beforeEach(() => {
    // Clear mock call history before each test
    (invoke as jest.Mock).mockClear();
  });

  it('getNotesDirectory should call invoke with correct command', async () => {
    await getNotesDirectory();
    expect(invoke).toHaveBeenCalledWith('get_notes_directory');
  });

  it('setNotesDirectory should call invoke with correct command and path', async () => {
    const path = '/test/notes';
    await setNotesDirectory(path);
    expect(invoke).toHaveBeenCalledWith('set_notes_directory', { path });
  });

  it('getAudioDirectory should call invoke with correct command', async () => {
    await getAudioDirectory();
    expect(invoke).toHaveBeenCalledWith('get_audio_directory');
  });

  it('setAudioDirectory should call invoke with correct command and path', async () => {
    const path = '/test/audio';
    await setAudioDirectory(path);
    expect(invoke).toHaveBeenCalledWith('set_audio_directory', { path });
  });

  it('getAllNotes should call invoke with correct command', async () => {
    const mockNotes: NoteMetadata[] = [{ id: '1', title: 'Test Note', path: '/notes/1.md', createdAt: '', updatedAt: '' }];
    (invoke as jest.Mock).mockResolvedValueOnce(mockNotes);
    const result = await getAllNotes();
    expect(invoke).toHaveBeenCalledWith('get_all_notes');
    expect(result).toEqual(mockNotes);
  });

  it('searchNotes should call invoke with correct command and query', async () => {
    const query = 'test';
    const mockNotes: NoteMetadata[] = [{ id: '1', title: 'Test Note', path: '/notes/1.md', createdAt: '', updatedAt: '' }];
    (invoke as jest.Mock).mockResolvedValueOnce(mockNotes);
    const result = await searchNotes(query);
    expect(invoke).toHaveBeenCalledWith('search_notes', { query });
    expect(result).toEqual(mockNotes);
  });

  it('readNoteContent should call invoke with correct command and path', async () => {
    const path = '/test/notes/note1.json';
    // Mock a Note structure, assuming content is a JSON string for Lexical state
    const mockNote: Note = {
      id: '1',
      title: 'Note 1',
      content: '{"root":{"children":[{"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"version":1}}',
      path: path,
      createdAt: '',
      updatedAt: ''
    };
    (invoke as jest.Mock).mockResolvedValueOnce(mockNote);
    const result = await readNoteContent(path);
    expect(invoke).toHaveBeenCalledWith('read_note_content', { path });
    expect(result).toEqual(mockNote);
  });

  it('writeNoteContent should call invoke with correct command, path, and JSON content', async () => {
    const path = '/test/notes/note1.json';
    const content: Note = { // Actually, the API expects a full Note object for content as per previous change
      id: '1',
      title: 'Note 1',
      content: '{"root":{"children":[{"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"version":1}}',
      path: path,
      createdAt: '',
      updatedAt: ''
    };
    await writeNoteContent(path, content);
    // The backend command `write_note_content` likely expects the note content string, not the full Note object.
    // However, our TypeScript signature for writeNoteContent is `(path: string, content: Note)`
    // This implies the `content` field of the `Note` object (which is the JSON string) is what's sent, or the whole object.
    // Based on the previous change `writeNoteContent(path: string, content: Note)`, it sends the whole Note object.
    expect(invoke).toHaveBeenCalledWith('write_note_content', { path, content });
  });

  it('createNote should call invoke with correct command, title, and JSON content', async () => {
    const title = 'New Note';
    const content: Note = { // Similar to writeNoteContent, this sends a Note object.
      id: 'temp-id', // Or whatever ID is generated/used before backend confirmation
      title: title,
      content: '{"root":{"children":[{"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"version":1}}',
      path: '', // Path might be determined by backend
      createdAt: '',
      updatedAt: ''
    };
    const mockCreatedNote: Note = { ...content, id: '2', path: '/notes/2.json' };
    (invoke as jest.Mock).mockResolvedValueOnce(mockCreatedNote);

    const result = await createNote(title, content);
    expect(invoke).toHaveBeenCalledWith('create_note', { title, content });
    expect(result).toEqual(mockCreatedNote);
  });

  it('createDailyNote should call invoke with correct command', async () => {
    const mockDailyNote: Note = {
      id: 'daily',
      title: 'Daily Note',
      content: '{}',
      path: '/daily/note.json',
      createdAt: '',
      updatedAt: ''
    };
    (invoke as jest.Mock).mockResolvedValueOnce(mockDailyNote);
    const result = await createDailyNote();
    expect(invoke).toHaveBeenCalledWith('create_daily_note');
    expect(result).toEqual(mockDailyNote);
  });

  it('deleteNote should call invoke with correct command and noteId', async () => {
    const noteId = '123';
    await deleteNote(noteId);
    expect(invoke).toHaveBeenCalledWith('delete_note', { note_id: noteId });
  });

  it('findBacklinks should call invoke with correct command and noteId', async () => {
    const noteId = '123';
    const mockBacklinks: NoteMetadata[] = [{ id: '2', title: 'Backlink Note', path: '/notes/2.md', createdAt: '', updatedAt: '' }];
    (invoke as jest.Mock).mockResolvedValueOnce(mockBacklinks);
    const result = await findBacklinks(noteId);
    expect(invoke).toHaveBeenCalledWith('find_backlinks', { note_id: noteId });
    expect(result).toEqual(mockBacklinks);
  });
});

// Helper type for Note content if it's more structured, though current code treats it as string
// For `readNoteContent` and `writeNoteContent`, the `content` field of `Note` is a JSON string.
// For `createNote`, the `content` parameter is a `Note` object, whose `content` field is a JSON string.
// This seems a bit inconsistent. Let's assume the `content` parameter for `createNote` in `fileSystem.ts`
// should actually be the JSON string, and the backend `create_note` command takes `title` and `content_json_string`.
// Re-evaluating the `createNote` signature in `fileSystem.ts` from previous subtask:
// `export async function createNote(title: string, content: Note): Promise<Note>`
// This means the `content` object being passed is indeed a `Note` object.
// The test for `createNote` and `writeNoteContent` reflects this.
// The backend might then extract the `.content` field from this `Note` object if it only needs the JSON string.
// Or, the backend command itself expects a serialized `Note` object for the `content` parameter.
// The current tests align with the TypeScript signatures.
