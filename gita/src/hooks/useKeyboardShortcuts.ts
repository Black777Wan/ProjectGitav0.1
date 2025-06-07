// gita/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from 'uuid';
import { useAudioRecordingStore } from '../stores/audioRecordingStore'; // Adjust path
import { getAudioDirectory } from '../api/fileSystem'; // Adjust path

interface UseKeyboardShortcutsParams {
  selectedNoteId: string | null;
  addErrorMessage: (message: string) => void;
  handleNewNote: () => void;
  handleDailyNote: () => void;
  handleSaveNote: () => void;
  setShowKeyboardShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchFocusRequested: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useKeyboardShortcuts = ({
  selectedNoteId,
  addErrorMessage,
  handleNewNote,
  handleDailyNote,
  handleSaveNote,
  setShowKeyboardShortcuts,
  setSearchFocusRequested,
}: UseKeyboardShortcutsParams) => {
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
                storeActions.stopRecording(); // Ensure UI resets
              });
          } else {
            storeActions.stopRecording();
          }
        } else {
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
                addErrorMessage(`Failed to start recording: ${(err as Error).message}`);
              });
          } else {
            addErrorMessage("Please select a note to start recording.");
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
  }, [selectedNoteId, addErrorMessage, handleNewNote, handleDailyNote, handleSaveNote, setShowKeyboardShortcuts, setSearchFocusRequested]);
};
