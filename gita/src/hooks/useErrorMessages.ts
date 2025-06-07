// gita/src/hooks/useErrorMessages.ts
import { useState, useCallback } from 'react';
import { ErrorMessage } from '../types'; // Adjust path as needed

export const useErrorMessages = () => {
  const [errorMessages, setErrorMessages] = useState<ErrorMessage[]>([]);

  const addErrorMessage = useCallback((message: string) => {
    const id = `err_${Date.now()}`;
    setErrorMessages(prevErrors => [...prevErrors, { id, message }]);
  }, []);

  const removeErrorMessage = useCallback((id: string) => {
    setErrorMessages(prevErrors => prevErrors.filter(error => error.id !== id));
  }, []);

  return {
    errorMessages,
    addErrorMessage,
    removeErrorMessage,
  };
};
