import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import EditorContainer from "./components/EditorContainer";
import LexicalEditor from "./components/editor/LexicalEditor";
import AudioRecordingsList from "./components/AudioRecordingsList";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import ThemeToggle from "./components/ThemeToggle";
import { Note } from "./types";
import { getAllNotes, readMarkdownFile, writeMarkdownFile, createNote, createDailyNote, getAudioDirectory } from "./api/fileSystem"; // Added getAudioDirectory
import { invoke } from "@tauri-apps/api/tauri"; // Import invoke
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// import { startRecording, stopRecording } from "./api/audio"; // These will be invoked by toolbar via Tauri
import { FiHelpCircle, FiSettings } from "react-icons/fi";
import Tooltip from "./components/Tooltip";
import { useAudioRecordingStore } from "./stores/audioRecordingStore"; // Import Zustand store

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  // Removed local isRecording and currentRecordingId state
  const [isLoading, setIsLoading] = useState(true);
  const [showAudioRecordings, setShowAudioRecordings] = useState(false);
  const [audioRecordingsNoteId, setAudioRecordingsNoteId] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Get the selected note
  const selectedNote = notes.find(note => note.id === selectedNoteId) || null;

  // Load all notes on component mount
  useEffect(() => {
    const loadNotes = async () => {
      try {
        setIsLoading(true);
        const noteMetadata = await getAllNotes();
        
        // Load the content of each note
        const loadedNotes = await Promise.all(
          noteMetadata.map(async (meta) => {
            try {
              return await readMarkdownFile(meta.path);
            } catch (error) {
              console.error(`Error loading note ${meta.path}:`, error);
              // Return a placeholder note if loading fails
              return {
                id: meta.id,
                title: meta.title,
                path: meta.path,
                content: `# ${meta.title}\n\nError loading note content.`,
                createdAt: meta.created_at,
                updatedAt: meta.updated_at,
                tags: meta.tags,
              };
            }
          })
        );
        
        setNotes(loadedNotes);
        
        // Select the first note if available
        if (loadedNotes.length > 0 && !selectedNoteId) {
          setSelectedNoteId(loadedNotes[0].id);
        }
      } catch (error) {
        console.error("Error loading notes:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadNotes();
  }, []);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts if no input element is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement ||
                             activeElement?.getAttribute('contenteditable') === 'true';
      
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
      
      // Ctrl+R: Toggle recording globally
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        const storeState = useAudioRecordingStore.getState();
        const storeActions = storeState.actions;

        if (storeState.isRecordingActive) {
          // Stop recording
          if (storeState.currentRecordingId) {
            invoke('stop_recording', { recordingId: storeState.currentRecordingId })
              .then(() => {
                storeActions.stopRecording();
                console.log("Global shortcut: Recording stopped.");
              })
              .catch(err => {
                console.error("Global shortcut: Failed to stop recording via invoke:", err);
                // Optionally still update UI store state if backend failed but we want UI to reflect stop
                // storeActions.stopRecording();
              });
          } else {
            console.warn("Global shortcut: Stop recording attempted but no currentRecordingId in store.");
            storeActions.stopRecording(); // Still try to reset UI state
          }
        } else {
          // Start recording
          if (selectedNoteId) {
            const newRecordingId = uuidv4();
            getAudioDirectory()
              .then(audioDir => {
                const anticipatedFilePath = `${audioDir}/${newRecordingId}.wav`;
                return invoke('start_recording', { noteId: selectedNoteId, recordingId: newRecordingId })
                  .then(() => {
                    storeActions.startRecording(newRecordingId, anticipatedFilePath);
                    console.log("Global shortcut: Recording started.");
                  });
              })
              .catch(err => {
                console.error("Global shortcut: Failed to start recording:", err);
              });
          } else {
            console.warn("Global shortcut: Start recording attempted but no note selected.");
            // Optionally inform user: "Please select a note to start recording."
          }
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
  }, [selectedNoteId]); // Removed isRecording from dependencies

  const handleNewNote = async () => {
    try {
      const title = `New Note ${new Date().toLocaleTimeString()}`;
      const content = `# ${title}\n\nStart writing here...`;
      
      const newNote = await createNote(title, content);
      
      setNotes([...notes, newNote]);
      setSelectedNoteId(newNote.id);
      setShowAudioRecordings(false);
    } catch (error) {
      console.error("Error creating new note:", error);
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
      console.error("Error creating daily note:", error);
    }
  };

  // Removed handleStartRecording and handleStopRecording functions
  // Their logic is now in EditorToolbar.tsx, using Zustand store and Tauri invoke.

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
      console.error("Failed to save note:", error);
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
    <div className="flex h-screen bg-obsidian-bg text-obsidian-text">
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
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top toolbar */}
        <div className="flex items-center justify-end p-2 border-b border-obsidian-border bg-obsidian-bg">
          <div className="flex items-center space-x-2">
            <Tooltip text="Toggle Theme">
              <ThemeToggle />
            </Tooltip>
            
            <Tooltip text="Keyboard Shortcuts (Ctrl+/)">
              <button
                onClick={() => setShowKeyboardShortcuts(true)}
                className="p-2 rounded-full hover:bg-obsidian-hover transition-colors duration-200"
              >
                <FiHelpCircle size={18} />
              </button>
            </Tooltip>
            
            <Tooltip text="Settings">
              <button
                onClick={handleOpenSettings}
                className="p-2 rounded-full hover:bg-obsidian-hover transition-colors duration-200"
              >
                <FiSettings size={18} />
              </button>
            </Tooltip>
          </div>
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-obsidian-muted">
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
                currentNoteId={selectedNote.id} // Pass currentNoteId
                // isRecording, onStartRecording, onStopRecording removed
                onSave={handleSaveNote}
              >
                <LexicalEditor 
                  initialContent={selectedNote.content}
                  onChange={handleEditorChange}
                  currentNoteId={selectedNote.id} // Pass currentNoteId
                  // isRecording, currentRecordingId props removed
                />
              </EditorContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-obsidian-muted">
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
    </div>
  );
}

export default App;

