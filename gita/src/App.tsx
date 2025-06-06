import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import EditorContainer from "./components/EditorContainer";
import LexicalEditor from "./components/editor/LexicalEditor";
import AudioRecordingsList from "./components/AudioRecordingsList";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import ThemeToggle from "./components/ThemeToggle";
import { Note, ErrorMessage } from "./types";
import { getAllNotes, readMarkdownFile, writeMarkdownFile, createNote, createDailyNote } from "./api/fileSystem";
import { startRecording, stopRecording } from "./api/audio";
import { FiHelpCircle, FiSettings } from "react-icons/fi";
import Tooltip from "./components/Tooltip";

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<ErrorMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAudioRecordings, setShowAudioRecordings] = useState(false);
  const [audioRecordingsNoteId, setAudioRecordingsNoteId] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  // State to trigger focus on search input in Sidebar, activated by Ctrl+F
  const [searchFocusRequested, setSearchFocusRequested] = useState(false);

  // Get the selected note
  const selectedNote = notes.find(note => note.id === selectedNoteId) || null;

  /**
   * `errorMessages` stores a list of error messages to be displayed to the user.
   * Each error has an id and a message.
   */
  // Utility function to add a new error message to the list
  const addErrorMessage = useCallback((message: string) => {
    const id = `err_${Date.now()}`;
    setErrorMessages(prevErrors => [...prevErrors, { id, message }]);
  }, []);

  // Utility function to remove an error message by its id
  const removeErrorMessage = useCallback((id: string) => {
    setErrorMessages(prevErrors => prevErrors.filter(error => error.id !== id));
  }, []);

  // Load all notes on component mount
  useEffect(() => {
    const loadNotes = async () => {
      try {
        setIsLoading(true);
        const noteMetadata = await getAllNotes();
        
        // Use Promise.allSettled to attempt loading all notes,
        // even if some individual reads fail.
        const loadedNotesResults = await Promise.allSettled(
          noteMetadata.map(async (meta) => {
            try {
              return await readMarkdownFile(meta.path);
            } catch (error) {
              addErrorMessage(`Error loading note ${meta.title}: ${(error as Error).message}`);
              // If a note fails to load, a placeholder note is returned.
              // This allows the app to still function with other notes
              // while visually indicating the failure for the specific note.
              return {
                id: meta.id,
                title: meta.title,
                path: meta.path,
                content: `# ${meta.title}\n\nError loading note content.`,
                createdAt: meta.created_at,
                updatedAt: meta.updated_at,
                tags: meta.tags,
              } as Note;
            }
          })
        );

        const loadedNotes = loadedNotesResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<Note>).value);

        const failedNotes = loadedNotesResults
          .filter(result => result.status === 'rejected')
          .length;

        if (failedNotes > 0) {
          // Placeholder notes are already added for failed notes,
          // addErrorMessage has been called for each in the map.
        }
        
        setNotes(loadedNotes);
        
        // Select the first note if available and no note is currently selected.
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
    // Dependency on selectedNoteId: Reloads notes if selectedNoteId changes.
    // This might be more frequent than just initial load if selectedNoteId is changed by other means
    // before notes are fully processed, or if a full refresh on selection change is desired.
    // For now, this ensures that if `selectedNoteId` was null and notes load, selection happens.
  }, [addErrorMessage, selectedNoteId]);

  // Set up global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      // Check if an input, textarea, or contentEditable element (like the Lexical editor) is focused.
      // If so, global shortcuts (except Ctrl+F) should not interfere with typing in those fields.
      const isInputFocused = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement ||
                             activeElement?.getAttribute('contenteditable') === 'true';
      
      // Ctrl+F is a special case: it should focus the search bar regardless of current focus.
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setSearchFocusRequested(true); // Triggers focus in Sidebar via prop
        return;
      }

      // If an input is focused, and it's not Ctrl+F, don't process global shortcuts.
      if (isInputFocused) return;
      
      // Ctrl+N: New note
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }
      
      // Ctrl+D: Daily note
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        handleDailyNote();
      }
      
      // Ctrl+S: Save note
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveNote();
      }
      
      // Ctrl+R: Toggle recording
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (isRecording) {
          handleStopRecording();
        } else {
          handleStartRecording();
        }
      }
      
      // Ctrl+/: Toggle keyboard shortcuts
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(prev => !prev);
      }
      
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowKeyboardShortcuts(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecording, selectedNoteId]); // searchFocusRequested is not in deps as its effect is managed by handleSearchFocused callback

  /**
   * Callback for Sidebar to signal that the search input has been focused.
   * Resets the `searchFocusRequested` state.
   */
  const handleSearchFocused = useCallback(() => {
    setSearchFocusRequested(false);
  }, []);

  const handleNewNote = async () => {
    try {
      const title = `New Note ${new Date().toLocaleTimeString()}`;
      const content = `# ${title}\n\nStart writing here...`;
      
      const newNote = await createNote(title, content);
      
      setNotes([...notes, newNote]);
      setSelectedNoteId(newNote.id);
      setShowAudioRecordings(false);
    } catch (error) {
      addErrorMessage(`Error creating new note: ${(error as Error).message}`);
    }
  };

  const handleDailyNote = async () => {
    try {
      const dailyNote = await createDailyNote();
      
      // Check if the note already exists in our list
      const existingNoteIndex = notes.findIndex(note => note.id === dailyNote.id);
      
      if (existingNoteIndex >= 0) {
        // Update the existing note
        const updatedNotes = [...notes];
        updatedNotes[existingNoteIndex] = dailyNote;
        setNotes(updatedNotes);
      } else {
        // Add the new note
        setNotes([...notes, dailyNote]);
      }
      
      setSelectedNoteId(dailyNote.id);
      setShowAudioRecordings(false);
    } catch (error) {
      addErrorMessage(`Error creating daily note: ${(error as Error).message}`);
    }
  };

  const handleStartRecording = async () => {
    if (!selectedNoteId) return;
    
    try {
      // Generate a unique recording ID
      const recordingId = `rec_${Date.now()}`;
      
      await startRecording(selectedNoteId, recordingId);
      
      setIsRecording(true);
      setCurrentRecordingId(recordingId);
    } catch (error) {
      addErrorMessage(`Failed to start recording: ${(error as Error).message}`);
    }
  };

  const handleStopRecording = async () => {
    if (!currentRecordingId) return;
    
    try {
      await stopRecording(currentRecordingId);
      
      setIsRecording(false);
      setCurrentRecordingId(null);
    } catch (error) {
      addErrorMessage(`Failed to stop recording: ${(error as Error).message}`);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;
    
    try {
      await writeMarkdownFile(selectedNote.path, selectedNote.content);
      
      // Update the note in the list
      const updatedNotes = notes.map(note => 
        note.id === selectedNote.id 
          ? { ...note, updatedAt: new Date().toISOString() } 
          : note
      );
      
      setNotes(updatedNotes);
    } catch (error) {
      addErrorMessage(`Failed to save note: ${(error as Error).message}`);
    }
  };

  const handleOpenSettings = () => {
    // This would normally open a settings modal or page
    console.log("Opening settings");
  };

  const handleEditorChange = (content: string) => {
    // Update the note content when the editor changes
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

  return (
    <div className="flex h-screen bg-light-bg dark:bg-obsidian-bg text-light-text dark:text-obsidian-text">
      {/* Sidebar */}
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
          focusSearchInput={searchFocusRequested}
          onSearchFocused={handleSearchFocused}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top toolbar */}
        <div className="flex items-center justify-end p-2 border-b border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg">
          <div className="flex items-center space-x-2">
            <Tooltip text="Toggle Theme">
              <ThemeToggle />
            </Tooltip>
            
            <Tooltip text="Keyboard Shortcuts (Ctrl+/)">
              <button
                onClick={() => setShowKeyboardShortcuts(true)}
                className="p-2 rounded-full hover:bg-light-hover dark:hover:bg-obsidian-hover transition-colors duration-200"
              >
                <FiHelpCircle size={18} /> {/* Icon color will inherit from text-light-text/dark:text-obsidian-text */}
              </button>
            </Tooltip>
            
            <Tooltip text="Settings">
              <button
                onClick={handleOpenSettings}
                className="p-2 rounded-full hover:bg-light-hover dark:hover:bg-obsidian-hover transition-colors duration-200"
              >
                <FiSettings size={18} /> {/* Icon color will inherit */}
              </button>
            </Tooltip>
          </div>
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-light-muted dark:text-obsidian-muted">
              <div className="animate-pulse">Loading notes...</div>
            </div>
          ) : showAudioRecordings && audioRecordingsNoteId ? (
            <div className="animate-fadeIn">
              <AudioRecordingsList noteId={audioRecordingsNoteId} />
            </div>
          ) : selectedNote ? (
            <div className="h-full animate-fadeIn">
              <EditorContainer
                noteTitle={selectedNote.title}
                isRecording={isRecording}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                onSave={handleSaveNote}
              >
                <LexicalEditor 
                  initialContent={selectedNote.content}
                  onChange={handleEditorChange}
                  currentNoteId={selectedNote.id} // Pass currentNoteId
                  // isRecording and currentRecordingId are managed by Zustand/Toolbar now
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
      </div>
      
      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal 
        isOpen={showKeyboardShortcuts} 
        onClose={() => setShowKeyboardShortcuts(false)} 
      />

      {/* Error Messages Display */}
      {errorMessages.length > 0 && (
        <div className="fixed bottom-4 right-4 w-full max-w-xs space-y-2 z-50">
          {errorMessages.map((error) => (
            <div
              key={error.id}
              className="bg-red-500 text-white p-3 rounded-lg shadow-lg flex justify-between items-start animate-fadeIn"
            >
              <p className="text-sm">{error.message}</p>
              <button
                onClick={() => removeErrorMessage(error.id)}
                className="ml-2 text-red-100 hover:text-white"
                aria-label="Dismiss error"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;