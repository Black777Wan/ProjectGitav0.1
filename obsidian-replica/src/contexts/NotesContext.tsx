import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { v4 as uuidv4 } from 'uuid';

export interface Note {
  id: string;
  title: string;
  content: string;
  path: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  backlinks: string[];
  audioTimestamps: AudioTimestamp[];
}

export interface AudioTimestamp {
  id: string;
  noteId: string;
  blockId: string;
  startTime: number;
  endTime: number;
  audioFile: string;
  createdAt: number;
}

type NotesContextType = {
  notes: Note[];
  currentNote: Note | null;
  isLoading: boolean;
  error: Error | null;
  createNote: (title?: string, content?: string, path?: string) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  getNote: (id: string) => Note | undefined;
  getNotesInFolder: (path: string) => Note[];
  searchNotes: (query: string) => Promise<Note[]>;
  addAudioTimestamp: (noteId: string, blockId: string, audioFile: string, startTime: number, endTime: number) => Promise<AudioTimestamp>;
  getAudioTimestamps: (noteId: string) => AudioTimestamp[];
  refreshNotes: () => Promise<void>;
};

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load all notes on mount
  const loadNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      // This will invoke a Tauri command to read notes from disk
      const loadedNotes = await invoke<Note[]>('get_all_notes');
      setNotes(loadedNotes);
      
      // Set the first note as current if none is set
      if (loadedNotes.length > 0 && !currentNote) {
        setCurrentNote(loadedNotes[0]);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      setError(err instanceof Error ? err : new Error('Failed to load notes'));
    } finally {
      setIsLoading(false);
    }
  }, [currentNote]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const createNote = async (title: string = 'Untitled', content: string = '', path: string = ''): Promise<Note> => {
    try {
      const now = Date.now();
      const newNote: Note = {
        id: uuidv4(),
        title,
        content,
        path,
        createdAt: now,
        updatedAt: now,
        tags: [],
        isPinned: false,
        isArchived: false,
        backlinks: [],
        audioTimestamps: [],
      };

      // Save the note via Tauri
      await invoke('save_note', { note: newNote });
      
      // Update local state
      setNotes(prevNotes => [...prevNotes, newNote]);
      setCurrentNote(newNote);
      
      return newNote;
    } catch (err) {
      console.error('Failed to create note:', err);
      throw err;
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
    try {
      const noteIndex = notes.findIndex(note => note.id === id);
      if (noteIndex === -1) {
        throw new Error(`Note with id ${id} not found`);
      }

      const updatedNote = {
        ...notes[noteIndex],
        ...updates,
        updatedAt: Date.now(),
      };

      // Save the updated note via Tauri
      await invoke('save_note', { note: updatedNote });
      
      // Update local state
      const newNotes = [...notes];
      newNotes[noteIndex] = updatedNote;
      setNotes(newNotes);
      
      // Update current note if it's the one being updated
      if (currentNote?.id === id) {
        setCurrentNote(updatedNote);
      }
      
      return updatedNote;
    } catch (err) {
      console.error('Failed to update note:', err);
      throw err;
    }
  };

  const deleteNote = async (id: string): Promise<void> => {
    try {
      // Delete the note via Tauri
      await invoke('delete_note', { id });
      
      // Update local state
      setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
      
      // Clear current note if it's the one being deleted
      if (currentNote?.id === id) {
        setCurrentNote(notes.length > 1 ? notes[0] : null);
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  };

  const getNote = (id: string): Note | undefined => {
    return notes.find(note => note.id === id);
  };

  const getNotesInFolder = (path: string): Note[] => {
    return notes.filter(note => note.path === path);
  };

  const searchNotes = async (query: string): Promise<Note[]> => {
    try {
      // This will invoke a Tauri command to search notes
      return await invoke<Note[]>('search_notes', { query });
    } catch (err) {
      console.error('Failed to search notes:', err);
      return [];
    }
  };

  const addAudioTimestamp = async (
    noteId: string,
    blockId: string,
    audioFile: string,
    startTime: number,
    endTime: number
  ): Promise<AudioTimestamp> => {
    try {
      const timestamp: AudioTimestamp = {
        id: uuidv4(),
        noteId,
        blockId,
        audioFile,
        startTime,
        endTime,
        createdAt: Date.now(),
      };

      // Add the timestamp via Tauri
      await invoke('add_audio_timestamp', { timestamp });
      
      // Update local state
      const noteIndex = notes.findIndex(note => note.id === noteId);
      if (noteIndex !== -1) {
        const updatedNote = {
          ...notes[noteIndex],
          audioTimestamps: [...(notes[noteIndex].audioTimestamps || []), timestamp],
        };
        
        const newNotes = [...notes];
        newNotes[noteIndex] = updatedNote;
        setNotes(newNotes);
        
        if (currentNote?.id === noteId) {
          setCurrentNote(updatedNote);
        }
      }
      
      return timestamp;
    } catch (err) {
      console.error('Failed to add audio timestamp:', err);
      throw err;
    }
  };

  const getAudioTimestamps = (noteId: string): AudioTimestamp[] => {
    const note = notes.find(n => n.id === noteId);
    return note?.audioTimestamps || [];
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        currentNote,
        isLoading,
        error,
        createNote,
        updateNote,
        deleteNote,
        getNote,
        getNotesInFolder,
        searchNotes,
        addAudioTimestamp,
        getAudioTimestamps,
        refreshNotes: loadNotes,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
