import { useState, useEffect, useCallback } from "react"; // Keep useCallback
import Sidebar from "./components/Sidebar";
import EditorContainer from "./components/EditorContainer";
import LexicalEditor from "./components/editor/LexicalEditor";
import AudioRecordingsList from "./components/AudioRecordingsList";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";
import ThemeToggle from "./components/ThemeToggle";
import { Note } from "./types"; // ErrorMessage removed
import { useErrorMessages } from './hooks/useErrorMessages'; // Import the new hook
import { 
  getAllNotes, 
  readMarkdownFile, 
  writeMarkdownFile, 
  createNote, 
  createDailyNote, 
  deleteNote
} from "./api/fileSystem";
import { FiHelpCircle, FiSettings } from "react-icons/fi";
import Tooltip from "./components/Tooltip";
import ErrorDisplay from './components/ErrorDisplay'; // Import ErrorDisplay
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'; // Import the new hook

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const { errorMessages, addErrorMessage, removeErrorMessage } = useErrorMessages(); // Call the hook
  const [isLoading, setIsLoading] = useState(true);
  const [showAudioRecordings, setShowAudioRecordings] = useState(false);
  const [audioRecordingsNoteId, setAudioRecordingsNoteId] = useState<string | null>(null);  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  // searchFocusRequested state from jules_wip/previous work for Ctrl+F
  const [searchFocusRequested, setSearchFocusRequested] = useState(false);

  const selectedNote = notes.find(note => note.id === selectedNoteId) || null;

  useEffect(() => {
    const loadNotes = async () => {
      try {
        setIsLoading(true);
        const noteMetadata = await getAllNotes();
        const loadedNotesResults = await Promise.allSettled(
          noteMetadata.map(async (meta) => {
            try {
              return await readMarkdownFile(meta.path);
            } catch (error) {
              addErrorMessage(`Error loading note ${meta.title}: ${(error as Error).message}`); // Now uses hook's addErrorMessage
              return {
                id: meta.id, title: meta.title, path: meta.path,
                content: `# ${meta.title}

Error loading note content.`,
                createdAt: meta.created_at, updatedAt: meta.updated_at, tags: meta.tags,
              } as Note;
            }
          })
        );
        const loadedNotes = loadedNotesResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<Note>).value);
        setNotes(loadedNotes);
        if (loadedNotes.length > 0 && !selectedNoteId) {
          setSelectedNoteId(loadedNotes[0].id);
        }
      } catch (error) {
        addErrorMessage(`Error loading notes: ${(error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadNotes();
  }, [addErrorMessage, selectedNoteId]); // selectedNoteId dependency is intentional here

  const handleSearchFocused = useCallback(() => { // For Ctrl+F
    setSearchFocusRequested(false);
  }, []);

  const handleNewNote = useCallback(async () => {
    try {
      const title = `New Note ${new Date().toLocaleTimeString()}`;
      const content = `# ${title}

Start writing here...`;
      const newNote = await createNote(title, content);
      setNotes(prevNotes => [...prevNotes, newNote]);
      setSelectedNoteId(newNote.id);
      setShowAudioRecordings(false);
    } catch (error) {
      addErrorMessage(`Error creating new note: ${(error as Error).message}`);
    }
  }, [addErrorMessage]);

  const handleDailyNote = useCallback(async () => {
    try {
      const dailyNote = await createDailyNote();
      const existingNoteIndex = notes.findIndex(note => note.id === dailyNote.id);
      if (existingNoteIndex >= 0) {
        const updatedNotes = [...notes];
        updatedNotes[existingNoteIndex] = dailyNote;
        setNotes(updatedNotes);
      } else {
        setNotes(prevNotes => [...prevNotes, dailyNote]);
      }
      setSelectedNoteId(dailyNote.id);
      setShowAudioRecordings(false);
    } catch (error) {
      addErrorMessage(`Error creating daily note: ${(error as Error).message}`);
    }
  }, [addErrorMessage, notes]);

  const handleSaveNote = useCallback(async () => {
    if (!selectedNote) return;
    try {
      await writeMarkdownFile(selectedNote.path, selectedNote.content);
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === selectedNote.id
            ? { ...note, updatedAt: new Date().toISOString() }
            : note
        )
      );
    } catch (error) {
      addErrorMessage(`Failed to save note: ${(error as Error).message}`);
    }
  }, [selectedNote, addErrorMessage]);

  // Call the keyboard shortcuts hook
  useKeyboardShortcuts({
    selectedNoteId,
    addErrorMessage,
    handleNewNote,
    handleDailyNote,
    handleSaveNote,
    setShowKeyboardShortcuts,
    setSearchFocusRequested,
  });

  const handleOpenSettings = () => { console.log("Opening settings"); };

  const handleEditorChange = (content: string) => {
    if (selectedNoteId) {
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === selectedNoteId 
            ? { ...note, content, updatedAt: new Date().toISOString() } 
            : note
        )
      );
    }
  };
  const handleShowAudioRecordings = (noteId: string) => {
    setAudioRecordingsNoteId(noteId);
    setShowAudioRecordings(true);
  };

  const handleDeleteNote = useCallback(() => {
    setShowDeleteConfirmation(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedNote) return;
    
    try {
      await deleteNote(selectedNote.id);
      
      // Remove the note from the notes array
      const updatedNotes = notes.filter(note => note.id !== selectedNote.id);
      setNotes(updatedNotes);
      
      // Select the first available note or null
      if (updatedNotes.length > 0) {
        setSelectedNoteId(updatedNotes[0].id);
      } else {
        setSelectedNoteId(null);
      }
      
      setShowDeleteConfirmation(false);
    } catch (error) {
      addErrorMessage(`Failed to delete note: ${(error as Error).message}`);
      setShowDeleteConfirmation(false);
    }
  }, [selectedNote, notes, addErrorMessage]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirmation(false);
  }, []);

  return (
    <div className="flex h-screen bg-light-bg dark:bg-obsidian-bg text-light-text dark:text-obsidian-text">
      <div className="w-sidebar flex-shrink-0">
        <Sidebar
          onNewNote={handleNewNote}
          onDailyNote={handleDailyNote}
          onSelectNote={(noteId) => {
            setSelectedNoteId(noteId);
            setShowAudioRecordings(false);
          }}
          onOpenSettings={handleOpenSettings}
          onShowAudioRecordings={handleShowAudioRecordings}
          notes={notes}
          selectedNoteId={selectedNoteId}
          focusSearchInput={searchFocusRequested} // For Ctrl+F
          onSearchFocused={handleSearchFocused}   // For Ctrl+F
        />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-end p-2 border-b border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg">
          <div className="flex items-center space-x-2">
            <Tooltip text="Toggle Theme"><ThemeToggle /></Tooltip>
            <Tooltip text="Keyboard Shortcuts (Ctrl+/)">
              <button
                onClick={() => setShowKeyboardShortcuts(true)}
                className="p-2 rounded-full hover:bg-light-hover dark:hover:bg-obsidian-hover transition-colors duration-200"
              ><FiHelpCircle size={18} /></button>
            </Tooltip>
            <Tooltip text="Settings">
              <button
                onClick={handleOpenSettings}
                className="p-2 rounded-full hover:bg-light-hover dark:hover:bg-obsidian-hover transition-colors duration-200"
              ><FiSettings size={18} /></button>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-light-muted dark:text-obsidian-muted">
              <div className="animate-pulse">Loading notes...</div>
            </div>
          ) : showAudioRecordings && audioRecordingsNoteId ? (
            <div className="animate-fadeIn"><AudioRecordingsList noteId={audioRecordingsNoteId} /></div>
          ) : selectedNote ? (
            <div className="h-full animate-fadeIn">
              {/* Props for EditorContainer from jules_wip */}
              <EditorContainer
                noteTitle={selectedNote.title}
              >
                {/* Props for LexicalEditor are consistent */}                <LexicalEditor 
                  initialContent={selectedNote.content}
                  onChange={handleEditorChange}
                  currentNoteId={selectedNote.id}
                  onDeleteNote={handleDeleteNote}
                />
              </EditorContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-light-muted dark:text-obsidian-muted">
              {notes.length > 0 
                ? "Select a note or create a new one" 
                : "No notes found. Create a new note to get started."}
            </div>
          )}
        </div>
      </div>      <KeyboardShortcutsModal 
        isOpen={showKeyboardShortcuts} 
        onClose={() => setShowKeyboardShortcuts(false)} 
      />
      <DeleteConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        noteTitle={selectedNote?.title || ''}
      />
      <ErrorDisplay errorMessages={errorMessages} removeErrorMessage={removeErrorMessage} />
    </div>
  );
}

export default App;