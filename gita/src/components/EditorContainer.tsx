import React from 'react';
import { FiSave, FiLink, FiClock } from 'react-icons/fi';

interface EditorContainerProps {
  noteTitle: string;
  children: React.ReactNode; 
}

const EditorContainer: React.FC<EditorContainerProps> = ({
  noteTitle,
  children
}) => {
  return (
    <div className="flex flex-col h-screen">
      {/* Editor header with title - separate from content */}
      <div className="flex items-center justify-start p-2 border-b border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg">
        <div className="flex items-center">
          <h2 className="text-lg font-medium text-light-text dark:text-obsidian-text">{noteTitle}</h2>
        </div>
      </div>

      {/* Editor content - completely separate from title */}
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

