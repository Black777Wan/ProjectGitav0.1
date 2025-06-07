import React from 'react';
import { FiX } from 'react-icons/fi';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl+N', description: 'Create a new note' },
    { key: 'Ctrl+O', description: 'Open a note' },
    { key: 'Ctrl+S', description: 'Save the current note' },
    { key: 'Ctrl+F', description: 'Search in notes' },
    { key: 'Ctrl+/', description: 'Toggle keyboard shortcuts' },
    { key: 'Ctrl+B', description: 'Bold text' },
    { key: 'Ctrl+I', description: 'Italic text' },
    { key: 'Ctrl+K', description: 'Insert link' },
    { key: 'Ctrl+1-6', description: 'Heading levels 1-6' },
    { key: 'Ctrl+Shift+L', description: 'Insert bullet list' },
    { key: 'Ctrl+Shift+N', description: 'Insert numbered list' },
    { key: 'Ctrl+R', description: 'Start/stop recording' },
    // { key: 'Ctrl+T', description: 'Insert timestamp during recording' }, // Removed
    { key: 'Ctrl+D', description: 'Create daily note' },
    { key: 'Esc', description: 'Close modal or cancel current action' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-obsidian-active rounded-lg shadow-obsidian w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-obsidian-border">
          <h2 className="text-lg font-medium">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-obsidian-hover transition-colors duration-200"
            title="Close"
          >
            <FiX size={20} />
          </button>
        </div>
        
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-obsidian-hover rounded">
                <span className="text-obsidian-accent font-mono bg-obsidian-bg px-2 py-1 rounded text-sm">
                  {shortcut.key}
                </span>
                <span className="text-sm">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-obsidian-border text-center">
          <button
            onClick={onClose}
            className="btn btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;

