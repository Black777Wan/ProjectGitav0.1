import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotesProvider } from './contexts/NotesContext';
import { AudioProvider } from './contexts/AudioContext';
import Layout from './components/Layout';
import HomePage from './pages/Home';
import NotePage from './pages/Note';
import DailyNotesPage from './pages/DailyNotes';
import GraphViewPage from './pages/GraphView';
import SettingsPage from './pages/Settings';
import { Toaster } from 'react-hot-toast';
import { invoke } from '@tauri-apps/api/tauri';

function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize the app directory and settings
        await invoke('initialize_app');
        setAppReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();
  }, []);

  if (!appReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-center">
          <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-4">
            Obsidian Replica
          </div>
          <div className="text-gray-500 dark:text-gray-400">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <SettingsProvider>
        <NotesProvider>
          <AudioProvider>
            <Router>
              <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="daily" element={<DailyNotesPage />} />
                    <Route path="graph" element={<GraphViewPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path=":noteId" element={<NotePage />} />
                  </Route>
                </Routes>
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: 'var(--bg-color)',
                      color: 'var(--text-color)',
                      border: '1px solid var(--border-color)',
                    },
                  }}
                />
              </div>
            </Router>
          </AudioProvider>
        </NotesProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
