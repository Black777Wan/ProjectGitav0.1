// gita/src/components/ErrorDisplay.tsx
import React from 'react';
import { ErrorMessage } from '../types'; // Adjust path as needed

interface ErrorDisplayProps {
  errorMessages: ErrorMessage[];
  removeErrorMessage: (id: string) => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ errorMessages, removeErrorMessage }) => {
  if (errorMessages.length === 0) {
    return null;
  }

  return (
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
  );
};

export default ErrorDisplay;
