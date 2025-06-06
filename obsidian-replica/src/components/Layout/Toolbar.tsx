import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotes } from '../../contexts/NotesContext';
import { useAudio } from '../../contexts/AudioContext';
import { FiMenu, FiPlus, FiSearch, FiSun, FiMoon, FiMic, FiMicOff, FiSave, FiFolder, FiSettings, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolbarProps {
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
}

export default function Toolbar({ onToggleSidebar, onOpenCommandPalette }: ToolbarProps) {
  const { theme, setTheme } = useTheme();
  const { createNote, currentNote, updateNote } = useNotes();
  const { isRecording, startRecording, stopRecording } = useAudio();
  const [title, setTitle] = useState('');
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [showAudioControls, setShowAudioControls] = useState(false);
  const navigate = useNavigate();

  // Update title when current note changes
  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title || '');
    } else {
      setTitle('');
    }
  }, [currentNote]);

  const handleNewNote = async () => {
    const note = await createNote();
    if (note) {
      navigate(`/${note.id}`);
    }
  };

  const handleSave = async () => {
    if (currentNote && title.trim() !== currentNote.title) {
      await updateNote(currentNote.id, { title: title.trim() });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      handleSave();
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
      setShowAudioControls(false);
    } else if (currentNote) {
      await startRecording(currentNote.id);
      setShowAudioControls(true);
    }
  };

  return (
    <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Left side */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Toggle sidebar"
        >
          <FiMenu size={18} />
        </button>
        
        <button
          onClick={handleNewNote}
          className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <FiPlus size={16} className="mr-1.5" />
          <span>New</span>
        </button>
        
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          <FiSearch size={14} className="mr-1.5" />
          <span>Search</span>
          <span className="ml-4 text-xs text-gray-400">⌘P</span>
        </button>
      </div>
      
      {/* Center - Note title */}
      <div className="flex-1 max-w-2xl mx-4">
        {currentNote ? (
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={handleSave}
              onKeyDown={handleTitleKeyDown}
              className="w-full px-3 py-1 text-center bg-transparent border-b border-transparent focus:border-primary-500 focus:outline-none text-lg font-medium text-gray-900 dark:text-white"
              placeholder="Untitled"
            />
            <AnimatePresence>
              {isTitleFocused && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-1 text-xs text-center text-gray-500"
                >
                  Press Enter to save
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-lg font-medium text-gray-400 dark:text-gray-500">
            No note selected
          </div>
        )}
      </div>
      
      {/* Right side */}
      <div className="flex items-center space-x-2">
        {currentNote && (
          <>
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-full ${isRecording 
                ? 'text-white bg-red-500 hover:bg-red-600' 
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <FiMicOff size={18} /> : <FiMic size={18} />}
            </button>
            
            <button
              onClick={handleSave}
              className="p-2 text-gray-500 rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Save"
            >
              <FiSave size={18} />
            </button>
          </>
        )}
        
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
        </button>
        
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-gray-500 rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Settings"
        >
          <FiSettings size={18} />
        </button>
      </div>
      
      {/* Audio controls */}
      <AnimatePresence>
        {showAudioControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 z-50"
          >
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-sm font-medium">Recording...</span>
              </div>
              
              <button
                onClick={toggleRecording}
                className="px-3 py-1 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Stop
              </button>
              
              <button
                onClick={() => setShowAudioControls(false)}
                className="p-1 text-gray-400 hover:text-gray-500"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
