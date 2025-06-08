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
  // readMarkdownFile, // Removed
  // writeMarkdownFile, // Removed
  getPageDetails,  // Added
  updatePageContent, // Added
  createNote, 
  createDailyNote, 
  deleteNote
} from "./api/fileSystem";
import { FiHelpCircle, FiSettings } from "react-icons/fi";
import Tooltip from "./components/Tooltip";
import ErrorDisplay from './components/ErrorDisplay'; // Import ErrorDisplay
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'; // Import the new hook
import { convertLexicalJSONToMarkdown } from "./utils/lexicalUtils"; // Added import

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
    const loadInitialNotesMetadata = async () => {
      try {
        setIsLoading(true);
        const noteMetadata = await getAllNotes(); // Returns NoteMetadata[]
        const placeholderNotes: Note[] = noteMetadata.map(meta => ({
          id: meta.id,
          title: meta.title,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          content_json: '', // Placeholder, will be loaded on demand
          // raw_markdown: '', // Optional placeholder, can be omitted
        }));
        setNotes(placeholderNotes);

        if (placeholderNotes.length > 0 && !selectedNoteId) {
          setSelectedNoteId(placeholderNotes[0].id);
        }
        // If selectedNoteId already exists (e.g. from previous session state, not implemented here),
        // the other useEffect will pick it up and load its full content.
      } catch (error) {
        addErrorMessage(`Error loading initial notes: ${(error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialNotesMetadata();
  }, [addErrorMessage]); // Removed selectedNoteId, this effect is for initial metadata load

  // New useEffect to load full note data when selectedNoteId changes
  useEffect(() => {
    if (selectedNoteId) {
      const noteInState = notes.find(n => n.id === selectedNoteId);
      // Only fetch if content_json is placeholder (empty string)
      if (noteInState && noteInState.content_json === '') {
        // Consider adding a specific loading state for content if global `isLoading` is too broad
        // setIsLoading(true); // Or e.g. setIsLoadingSelectedNoteContent(true)
        getPageDetails(selectedNoteId)
          .then(fullNoteData => {
            setNotes(prevNotes => prevNotes.map(n => (n.id === selectedNoteId ? fullNoteData : n)));
          })
          .catch(error => {
            addErrorMessage(`Error loading note details for ${selectedNoteId}: ${(error as Error).message}`);
            // Optionally, clear selectedNoteId or handle this error more gracefully
            // For example, revert to a state where the note content is known to be unloadable
          })
          .finally(() => {
            // setIsLoading(false); // Or e.g. setIsLoadingSelectedNoteContent(false)
            // Global isLoading might be set to false too early if other things depend on it.
            // For now, the initial load handles the main isLoading.
          });
      }
    }
  }, [selectedNoteId, notes, addErrorMessage]);


  const handleSearchFocused = useCallback(() => { // For Ctrl+F
    setSearchFocusRequested(false);
  }, []);

  const handleNewNote = useCallback(async () => {
    try {
      const title = `New Note ${new Date().toLocaleTimeString()}`;
      // For createNote, we now send initialRawMarkdown.
      // Backend's create_note will handle creating a default content_json.
      const initialRawMarkdown = `# ${title}\n\nStart writing here...`;
      const newNote = await createNote(title, initialRawMarkdown); // newNote is a full Note object
      setNotes(prevNotes => [...prevNotes, newNote]);
      setSelectedNoteId(newNote.id);
      setShowAudioRecordings(false);
    } catch (error) {
      addErrorMessage(`Error creating new note: ${(error as Error).message}`);
    }
  }, [addErrorMessage]);

  const handleDailyNote = useCallback(async () => {
    try {
      const dailyNoteFull = await createDailyNote(); // Returns a full Note object
      const existingNoteIndex = notes.findIndex(note => note.id === dailyNoteFull.id);
      if (existingNoteIndex >= 0) {
        // If it exists, update it in the list (it might have been a placeholder)
        setNotes(prevNotes =>
          prevNotes.map(n => n.id === dailyNoteFull.id ? dailyNoteFull : n)
        );
      } else {
        setNotes(prevNotes => [...prevNotes, dailyNoteFull]);
      }
      setSelectedNoteId(dailyNoteFull.id);
      setShowAudioRecordings(false);
    } catch (error) {
      addErrorMessage(`Error creating daily note: ${(error as Error).message}`);
    }
  }, [addErrorMessage, notes]); // notes dependency needed if checking existingNoteIndex

  const handleSaveNote = useCallback(async () => {
    if (!selectedNote || selectedNote.content_json === '') {
      // Do not save if note is not fully loaded or no content_json
      addErrorMessage("Note content not fully loaded or empty. Cannot save.");
      return;
    }
    try {
      // Assuming selectedNote.content_json is already a string.
      // selectedNote.raw_markdown might be undefined, which is fine for updatePageContent.
      await updatePageContent(
        selectedNote.id,
        selectedNote.title,
        selectedNote.content_json, // This is already a string from Lexical
        selectedNote.raw_markdown
      );
      // Optionally, update the updated_at timestamp from backend if returned, or use client time
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === selectedNote.id
            ? { ...note, updated_at: new Date().toISOString() } // Use client time for now
            : note
        )
      );
      // addSuccessMessage("Note saved successfully!"); // If you have a success message system
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

  const handleEditorChange = (lexicalJsonString: string) => {
    if (selectedNoteId) {
      const newRawMarkdown = convertLexicalJSONToMarkdown(lexicalJsonString);
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === selectedNoteId
            ? {
                ...note,
                content_json: lexicalJsonString,
                raw_markdown: newRawMarkdown, // Update raw_markdown here
                updated_at: new Date().toISOString()
              }
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
                currentNoteId={selectedNote.id}
              >
                <LexicalEditor
                  key={selectedNote.id} // Ensure LexicalEditor re-initializes if note ID changes
                  initialContent={selectedNote.content_json} // Pass content_json
                  onChange={handleEditorChange}
                  currentNoteId={selectedNote.id}
                  onDeleteNote={handleDeleteNote}
                />
              </EditorContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-light-muted dark:text-obsidian-muted">
              {notes.length > 0 || isLoading // Show "Select a note..." even if notes are loading
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