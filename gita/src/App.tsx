import React, { useState, useEffect, useCallback } from "react"; // Keep useCallback
import Sidebar from "./components/Sidebar";
import EditorContainer from "./components/EditorContainer";
import LexicalEditor from "./components/editor/LexicalEditor";
import AudioRecordingsList from "./components/AudioRecordingsList";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import ThemeToggle from "./components/ThemeToggle";
import { Note, ErrorMessage } from "./types"; // Keep ErrorMessage from main
import { 
  getAllNotes, 
  readMarkdownFile, 
  writeMarkdownFile, 
  createNote, 
  createDailyNote, 
  getAudioDirectory // Keep from jules_wip
} from "./api/fileSystem";
import { invoke } from "@tauri-apps/api/core"; // Keep from jules_wip
import { v4 as uuidv4 } from 'uuid'; // Keep from jules_wip
import { FiHelpCircle, FiSettings } from "react-icons/fi";
import Tooltip from "./components/Tooltip";
import { useAudioRecordingStore } from "./stores/audioRecordingStore"; // Keep from jules_wip

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  // errorMessages state and utilities from main/previous work
  const [errorMessages, setErrorMessages] = useState<ErrorMessage[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [showAudioRecordings, setShowAudioRecordings] = useState(false);
  const [audioRecordingsNoteId, setAudioRecordingsNoteId] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  // searchFocusRequested state from jules_wip/previous work for Ctrl+F
  const [searchFocusRequested, setSearchFocusRequested] = useState(false);

  const selectedNote = notes.find(note => note.id === selectedNoteId) || null;

  const addErrorMessage = useCallback((message: string) => {
    const id = `err_${Date.now()}`;
    setErrorMessages(prevErrors => [...prevErrors, { id, message }]);
  }, []);

  const removeErrorMessage = useCallback((id: string) => {
    setErrorMessages(prevErrors => prevErrors.filter(error => error.id !== id));
  }, []);

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
              addErrorMessage(`Error loading note ${meta.title}: ${(error as Error).message}`);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement ||
                             activeElement?.getAttribute('contenteditable') === 'true';

      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setSearchFocusRequested(true);
        return;
      }
      if (isInputFocused) return;

      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); handleNewNote(); }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); handleDailyNote(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSaveNote(); }
      
      // Ctrl+R logic from jules_wip (uses Zustand and direct invoke)
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        const storeState = useAudioRecordingStore.getState();
        const storeActions = storeState.actions;

        if (storeState.isRecordingActive) {
          if (storeState.currentRecordingId) {
            invoke('stop_recording', { recordingId: storeState.currentRecordingId })
              .then(() => {
                storeActions.stopRecording();
                console.log("Global shortcut: Recording stopped.");
              })
              .catch(err => {
                addErrorMessage(`Failed to stop recording: ${(err as Error).message}`);
                // console.error("Global shortcut: Failed to stop recording via invoke:", err);
                // Optionally still update UI store state if backend failed
                storeActions.stopRecording(); // Ensure UI resets
              });
          } else {
            // console.warn("Global shortcut: Stop recording attempted but no currentRecordingId in store.");
            storeActions.stopRecording(); 
          }
        } else {
          if (selectedNoteId) {
            const newRecordingId = uuidv4();
            getAudioDirectory()
              .then(audioDir => {
                // Ensure consistent path construction (e.g. handling separators if audioDir might have trailing slash)
                // For now, direct concatenation is used as in original jules_wip.
                const anticipatedFilePath = `${audioDir}/${newRecordingId}.wav`; 
                return invoke('start_recording', { noteId: selectedNoteId, recordingId: newRecordingId })
                  .then(() => {
                    storeActions.startRecording(newRecordingId, anticipatedFilePath);
                    console.log("Global shortcut: Recording started.");
                  });
              })
              .catch(err => {
                addErrorMessage(`Failed to start recording: ${(err as Error).message}`);
                // console.error("Global shortcut: Failed to start recording:", err);
              });
          } else {
            addErrorMessage("Please select a note to start recording.");
            // console.warn("Global shortcut: Start recording attempted but no note selected.");
          }
        }
      }

      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowKeyboardShortcuts(prev => !prev); }
      if (e.key === 'Escape') { setShowKeyboardShortcuts(false); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Dependencies: selectedNoteId for Ctrl+R, addErrorMessage for error reporting,
    // handleSearchFocused for Ctrl+F (though it's stable, including it is fine).
  }, [selectedNoteId, addErrorMessage, handleSearchFocused]);

  const handleNewNote = async () => {
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
  };

  const handleDailyNote = async () => {
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
  };

  // Local handleStartRecording and handleStopRecording are removed (from jules_wip)

  const handleSaveNote = async () => {
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
  };

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
                onSave={handleSaveNote}
              >
                {/* Props for LexicalEditor are consistent */}
                <LexicalEditor 
                  initialContent={selectedNote.content}
                  onChange={handleEditorChange}
                  currentNoteId={selectedNote.id}
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
      <KeyboardShortcutsModal 
        isOpen={showKeyboardShortcuts} 
        onClose={() => setShowKeyboardShortcuts(false)} 
      />
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
              >&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;