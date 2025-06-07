import React from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  noteTitle: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  noteTitle,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      onConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-light-bg dark:bg-obsidian-bg border border-light-border dark:border-obsidian-border rounded-lg shadow-lg max-w-md w-full mx-4 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-obsidian-border">
          <div className="flex items-center">
            <FiAlertTriangle className="text-red-500 mr-2" size={20} />
            <h2 className="text-lg font-semibold text-light-text dark:text-obsidian-text">
              Delete Note
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-light-hover dark:hover:bg-obsidian-hover rounded transition-colors duration-200"
          >
            <FiX size={20} className="text-light-muted dark:text-obsidian-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-light-text dark:text-obsidian-text mb-2">
            Are you sure you want to delete this note?
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4">
            <p className="text-red-800 dark:text-red-200 font-medium">
              "{noteTitle}"
            </p>
            <p className="text-red-600 dark:text-red-300 text-sm mt-1">
              This action cannot be undone. The note will be permanently deleted.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-light-border dark:border-obsidian-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-light-muted dark:text-obsidian-muted hover:text-light-text dark:hover:text-obsidian-text hover:bg-light-hover dark:hover:bg-obsidian-hover rounded transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-obsidian-bg"
            autoFocus
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
