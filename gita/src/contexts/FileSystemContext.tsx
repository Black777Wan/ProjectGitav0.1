import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface FileInfo {
  path: string;
  name: string;
  is_directory: boolean;
  children?: FileInfo[];
}

interface FileSystemContextType {
  files: FileInfo[];
  currentFile: string | null;
  fileContent: string;
  isLoading: boolean;
  error: string | null;
  setCurrentFile: (path: string) => void;
  saveContent: (content: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  createDailyNote: () => Promise<void>;
  vaultPath: string;
  setVaultPath: (path: string) => void;
}

const defaultContext: FileSystemContextType = {
  files: [],
  currentFile: null,
  fileContent: '',
  isLoading: false,
  error: null,
  setCurrentFile: () => {},
  saveContent: async () => {},
  refreshFiles: async () => {},
  createDailyNote: async () => {},
  vaultPath: '',
  setVaultPath: () => {},
};

const FileSystemContext = createContext<FileSystemContextType>(defaultContext);

export const useFileSystem = () => useContext(FileSystemContext);

interface FileSystemProviderProps {
  children: ReactNode;
  initialVaultPath?: string;
}

export const FileSystemProvider: React.FC<FileSystemProviderProps> = ({ 
  children, 
  initialVaultPath = localStorage.getItem('vaultPath') || '' 
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultPath, setVaultPathState] = useState<string>(initialVaultPath);

  const setVaultPath = (path: string) => {
    setVaultPathState(path);
    localStorage.setItem('vaultPath', path);
  };

  const refreshFiles = async () => {
    if (!vaultPath) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const allFiles = await invoke<FileInfo[]>('get_all_notes', { vaultPath });
      setFiles(allFiles);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFileContent = async (path: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const content = await invoke<string>('read_note_content', { filePath: path });
      setFileContent(content);
      setCurrentFile(path);
    } catch (err) {
      console.error('Error loading file:', err);
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  const saveContent = async (content: string) => {
    if (!currentFile) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await invoke('write_note_content', { filePath: currentFile, content });
      setFileContent(content);
    } catch (err) {
      console.error('Error saving file:', err);
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  const createDailyNote = async () => {
    if (!vaultPath) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const newNotePath = await invoke<string>('create_daily_note', { vaultPath });
      await refreshFiles();
      setCurrentFile(newNotePath);
      await loadFileContent(newNotePath);
    } catch (err) {
      console.error('Error creating daily note:', err);
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  // Load files when vault path changes
  useEffect(() => {
    if (vaultPath) {
      refreshFiles();
    }
  }, [vaultPath]);

  // Load file content when current file changes
  useEffect(() => {
    if (currentFile) {
      loadFileContent(currentFile);
    }
  }, [currentFile]);

  return (
    <FileSystemContext.Provider
      value={{
        files,
        currentFile,
        fileContent,
        isLoading,
        error,
        setCurrentFile,
        saveContent,
        refreshFiles,
        createDailyNote,
        vaultPath,
        setVaultPath,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
};
