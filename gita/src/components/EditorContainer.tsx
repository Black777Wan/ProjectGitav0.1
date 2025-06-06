import React from 'react';
import { FiSave, FiLink, FiClock } from 'react-icons/fi';
import AudioRecorder from './AudioRecorder';

interface EditorContainerProps {
  noteTitle: string;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

const EditorContainer: React.FC<EditorContainerProps> = ({
  noteTitle,
  isRecording,
  onStartRecording,
  onStopRecording,
  onSave,
  children
}) => {
  return (
    <div className="flex flex-col h-screen"> {/* Outer container itself doesn't need a bg if App.tsx provides one */}
      {/* Editor header */}
      <div className="flex items-center justify-between p-2 border-b border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg">
        <div className="flex items-center">
          <h2 className="text-lg font-medium text-light-text dark:text-obsidian-text">{noteTitle}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <AudioRecorder 
            isRecording={isRecording}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
          />
          <button 
            className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover text-light-text dark:text-obsidian-text"
            onClick={onSave}
            title="Save"
          >
            <FiSave /> {/* Icon inherits color */}
          </button>
        </div>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center justify-center py-1 bg-red-600 text-white text-sm">
          Recording in progress...
        </div>
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <div className="editor-container">
          {children}
        </div>
      </div>

      {/* Editor footer */}
      <div className="flex items-center justify-between p-2 border-t border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg text-xs text-light-muted dark:text-obsidian-muted">
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

