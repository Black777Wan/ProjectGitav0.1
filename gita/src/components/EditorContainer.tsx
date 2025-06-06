import React from 'react';
import { FiSave, FiLink, FiClock } from 'react-icons/fi';
// import AudioRecorder from './AudioRecorder'; // Removed AudioRecorder

interface EditorContainerProps {
  noteTitle: string;
  currentNoteId: string; // Added for LexicalEditor
  // isRecording, onStartRecording, onStopRecording removed
  onSave: () => void;
  children: React.ReactNode; // This will be LexicalEditor
}

const EditorContainer: React.FC<EditorContainerProps> = ({
  noteTitle,
  currentNoteId, // Added
  // isRecording, // Removed
  // onStartRecording, // Removed
  // onStopRecording, // Removed
  onSave,
  children // LexicalEditor is passed here
}) => {
  // To pass currentNoteId to LexicalEditor, we need to ensure children can accept it.
  // This typically means LexicalEditor is the direct child and we clone it, or App.tsx structures it.
  // Given App.tsx structure, `children` IS LexicalEditor, and App.tsx passes currentNoteId to it directly.
  // So, EditorContainer itself doesn't need to explicitly pass currentNoteId to `children` here if App.tsx handles it.
  // However, the props for LexicalEditor are set in App.tsx.
  // This component, EditorContainer, is now simpler.

  return (
    <div className="flex flex-col h-screen">
      {/* Editor header */}
      <div className="flex items-center justify-between p-2 border-b border-obsidian-border bg-obsidian-bg">
        <div className="flex items-center">
          <h2 className="text-lg font-medium text-obsidian-text">{noteTitle}</h2>
        </div>
        <div className="flex items-center space-x-2">
          {/* AudioRecorder component removed */}
          <button 
            className="p-1.5 rounded hover:bg-obsidian-hover"
            onClick={onSave}
            title="Save"
          >
            <FiSave />
          </button>
        </div>
      </div>

      {/* Recording indicator - This will now be handled by EditorToolbar via Zustand store */}
      {/*
      {isRecording && ( // This local isRecording is removed
        <div className="flex items-center justify-center py-1 bg-red-600 text-white text-sm">
          Recording in progress...
        </div>
      )}
      */}

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <div className="editor-container">
          {children}
        </div>
      </div>

      {/* Editor footer */}
      <div className="flex items-center justify-between p-2 border-t border-obsidian-border bg-obsidian-bg text-xs text-obsidian-muted">
        <div className="flex items-center">
          <FiClock className="mr-1" /> Last modified: Today at 10:30 AM
        </div>
        <div className="flex items-center">
          <FiLink className="mr-1" /> 2 backlinks
        </div>
      </div>
    </div>
  );
};

export default EditorContainer;

