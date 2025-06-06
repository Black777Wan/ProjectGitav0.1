import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotes } from '../../contexts/NotesContext';
import { useAudio } from '../../contexts/AudioContext';
import Sidebar from './Sidebar';
import Toolbar from './Toolbar';
import StatusBar from './StatusBar';
import CommandPalette from '../CommandPalette';
import { invoke } from '@tauri-apps/api/tauri';

export default function Layout() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { createNote } = useNotes();
  const { isRecording, stopRecording } = useAudio();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Apply theme from settings on mount
  useEffect(() => {
    if (settings.appearance.theme !== theme) {
      setTheme(settings.appearance.theme);
    }
  }, [settings.appearance.theme, theme, setTheme]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle command palette with Cmd/Ctrl + P
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }

      // Create new note with Cmd/Ctrl + N
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        createNote();
      }

      // Toggle sidebar with Cmd/Ctrl + \
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }

      // Stop recording with Escape (if currently recording)
      if (e.key === 'Escape' && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNote, isRecording, stopRecording]);

  // Handle app initialization
  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize the app directory structure
        await invoke('init_app');
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-center">
          <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-4">
            Obsidian Replica
          </div>
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <Toolbar 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            <Outlet />
          </div>
          
          <StatusBar />
        </main>
      </div>

      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
      />
    </div>
  );
}
