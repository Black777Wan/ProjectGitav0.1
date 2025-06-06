import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAudio } from '../../contexts/AudioContext';
import { FiSearch, FiFile, FiFolder, FiMoon, FiSun, FiSettings, FiMic, FiX, FiPlus } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface Command {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'notes' | 'actions' | 'navigation' | 'settings';
  keywords: string[];
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { notes, createNote } = useNotes();
  const { theme, setTheme } = useTheme();
  const { isRecording, toggleRecording } = useAudio();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Generate commands based on current state
  const allCommands: Command[] = [
    // Note actions
    {
      id: 'new-note',
      title: 'New Note',
      description: 'Create a new note',
      icon: <FiFile className="text-blue-500" />,
      category: 'notes',
      keywords: ['create', 'add', 'new'],
      action: async () => {
        const note = await createNote();
        if (note) {
          navigate(`/${note.id}`);
          onClose();
        }
      },
    },
    {
      id: 'toggle-recording',
      title: isRecording ? 'Stop Recording' : 'Start Recording',
      description: isRecording ? 'Stop the current recording' : 'Start a new audio recording',
      icon: <FiMic className="text-red-500" />,
      category: 'actions',
      keywords: ['audio', 'mic', 'record', 'voice'],
      action: () => {
        toggleRecording();
        onClose();
      },
    },
    
    // Navigation
    {
      id: 'go-to-settings',
      title: 'Open Settings',
      description: 'Go to application settings',
      icon: <FiSettings className="text-gray-500" />,
      category: 'navigation',
      keywords: ['preferences', 'options', 'config'],
      action: () => {
        navigate('/settings');
        onClose();
      },
    },
    
    // Theme
    {
      id: 'toggle-theme',
      title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      description: `Change theme to ${theme === 'dark' ? 'light' : 'dark'} mode`,
      icon: theme === 'dark' ? <FiSun className="text-yellow-500" /> : <FiMoon className="text-gray-700" />,
      category: 'settings',
      keywords: ['appearance', 'theme', 'dark', 'light'],
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        onClose();
      },
    },
    
    // Recent notes (dynamically generated)
    ...notes.slice(0, 5).map((note, index) => ({
      id: `note-${note.id}`,
      title: note.title || 'Untitled',
      description: note.content?.substring(0, 100) || 'No content',
      icon: <FiFile className="text-blue-500" />,
      category: 'notes' as const,
      keywords: ['open', 'note', 'recent', 'edit'],
      action: () => {
        navigate(`/${note.id}`);
        onClose();
      },
    })),
  ];

  // Filter commands based on search query
  const filteredCommands = allCommands.filter((cmd) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.keywords.some(kw => kw.toLowerCase().includes(query))
    );
  });

  // Group commands by category
  const commandsByCategory = filteredCommands.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      
      // Navigate with arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      }
      
      // Execute command on Enter
      if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Reset selected index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.command-palette')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" aria-hidden="true" />
        
        {/* Center the modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>
        
        {/* Command palette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          className="inline-block w-full max-w-2xl overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 rounded-xl shadow-2xl command-palette"
        >
          {/* Search input */}
          <div className="relative p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <FiSearch className="w-5 h-5 text-gray-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              className="w-full py-3 pl-12 pr-4 text-gray-900 placeholder-gray-500 bg-transparent border-0 dark:text-white focus:ring-0 focus:outline-none sm:text-sm"
              placeholder="Type a command or search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <kbd className="inline-flex items-center px-2 py-1 text-xs font-sans border rounded-md text-gray-400 border-gray-300 dark:border-gray-600">
                Esc
              </kbd>
            </div>
          </div>
          
          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {Object.entries(commandsByCategory).length > 0 ? (
              Object.entries(commandsByCategory).map(([category, commands]) => (
                <div key={category} className="border-t border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    {category}
                  </div>
                  <ul className="py-1">
                    {commands.map((cmd, index) => {
                      const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <motion.li
                          key={cmd.id}
                          initial={false}
                          animate={{
                            backgroundColor: isSelected 
                              ? 'rgba(59, 130, 246, 0.1)' 
                              : 'transparent',
                          }}
                          className="px-4 py-2 cursor-pointer"
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                        >
                          <div className="flex items-center">
                            <div className="flex items-center justify-center w-8 h-8 mr-3 rounded-md bg-gray-100 dark:bg-gray-700">
                              {cmd.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate dark:text-white">
                                {cmd.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate dark:text-gray-400">
                                {cmd.description}
                              </p>
                            </div>
                            {isSelected && (
                              <div className="ml-2 text-xs text-gray-400">
                                <kbd className="px-1.5 py-0.5 border rounded-md bg-gray-100 dark:bg-gray-700 dark:border-gray-600">
                                  ↵
                                </kbd>
                              </div>
                            )}
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <FiSearch className="w-12 h-12 mx-auto text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  No commands match "{searchQuery}"
                </p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 dark:text-gray-400">
            <div className="flex space-x-4">
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 mr-1 border rounded-md bg-gray-100 dark:bg-gray-700 dark:border-gray-600">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 mr-1 border rounded-md bg-gray-100 dark:bg-gray-700 dark:border-gray-600">
                  ↵
                </kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 mr-1 border rounded-md bg-gray-100 dark:bg-gray-700 dark:border-gray-600">
                  Esc
                </kbd>
                <span>Close</span>
              </span>
            </div>
            <div>
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                v{settings.version}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
