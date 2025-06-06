import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAudio } from '../../contexts/AudioContext';
import { FiPlus, FiSearch, FiClock, FiStar, FiFileText, FiMic, FiMicOff } from 'react-icons/fi';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const Home = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { notes, createNote, recentNotes, pinnedNotes } = useNotes();
  const { isRecording, toggleRecording } = useAudio();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState(notes);
  
  // Filter notes based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredNotes(notes);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = notes.filter(note => 
      note.title?.toLowerCase().includes(query) || 
      note.content?.toLowerCase().includes(query)
    );
    
    setFilteredNotes(filtered);
  }, [searchQuery, notes]);
  
  // Handle creating a new note
  const handleNewNote = async () => {
    try {
      const note = await createNote();
      if (note) {
        navigate(`/${note.id}`);
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };
  
  // Handle quick record action
  const handleQuickRecord = () => {
    toggleRecording();
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 10,
      },
    },
  };
  
  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNewNote}
          className={`flex flex-col items-center justify-center p-6 rounded-xl transition-colors ${
            theme === 'dark' 
              ? 'bg-gray-800 hover:bg-gray-700' 
              : 'bg-white hover:bg-gray-50'
          } border border-gray-200 dark:border-gray-700`}
        >
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
            <FiPlus className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="font-medium">New Note</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Start writing
          </p>
        </motion.button>
        
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => document.getElementById('search-input')?.focus()}
          className={`flex flex-col items-center justify-center p-6 rounded-xl transition-colors ${
            theme === 'dark' 
              ? 'bg-gray-800 hover:bg-gray-700' 
              : 'bg-white hover:bg-gray-50'
          } border border-gray-200 dark:border-gray-700`}
        >
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
            <FiSearch className="w-6 h-6 text-purple-500" />
          </div>
          <h3 className="font-medium">Search</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Find notes
          </p>
        </motion.button>
        
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleQuickRecord}
          className={`flex flex-col items-center justify-center p-6 rounded-xl transition-colors ${
            isRecording
              ? 'bg-red-500/10 border-red-500/30'
              : theme === 'dark'
              ? 'bg-gray-800 hover:bg-gray-700 border-gray-700'
              : 'bg-white hover:bg-gray-50 border-gray-200'
          } border`}
        >
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
              isRecording 
                ? 'bg-red-100 dark:bg-red-900/50' 
                : 'bg-amber-100 dark:bg-amber-900/30'
            }`}
          >
            {isRecording ? (
              <FiMicOff className="w-6 h-6 text-red-500" />
            ) : (
              <FiMic className="w-6 h-6 text-amber-500" />
            )}
          </div>
          <h3 className="font-medium">
            {isRecording ? 'Stop Recording' : 'Record Audio'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isRecording ? 'Tap to stop' : 'Quick voice note'}
          </p>
        </motion.button>
      </div>
      
      {/* Search Bar */}
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-gray-400" />
        </div>
        <input
          id="search-input"
          type="text"
          className={`block w-full pl-10 pr-3 py-3 border ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          placeholder="Search your notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <FiStar className="w-5 h-5 text-amber-500 mr-2" />
            <h2 className="text-lg font-semibold">Pinned Notes</h2>
          </div>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {pinnedNotes.map((note) => (
              <motion.div
                key={note.id}
                variants={itemVariants}
                whileHover={{ y: -2 }}
                onClick={() => navigate(`/${note.id}`)}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${
                  theme === 'dark' 
                    ? 'bg-gray-800 hover:bg-gray-700' 
                    : 'bg-white hover:bg-gray-50'
                } border border-gray-200 dark:border-gray-700`}
              >
                <h3 className="font-medium mb-1 truncate">
                  {note.title || 'Untitled'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                  {note.content?.replace(/[#*_\[\]`]/g, '') || 'No content'}
                </p>
                <div className="flex items-center text-xs text-gray-400">
                  <FiClock className="mr-1" />
                  <span>
                    {note.updatedAt 
                      ? format(new Date(note.updatedAt), 'MMM d, yyyy')
                      : 'Just now'}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
      
      {/* Recent Notes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FiFileText className="w-5 h-5 text-blue-500 mr-2" />
            <h2 className="text-lg font-semibold">Recent Notes</h2>
          </div>
          {notes.length > 3 && (
            <button 
              onClick={() => navigate('/notes')}
              className="text-sm text-blue-500 hover:underline"
            >
              View all
            </button>
          )}
        </div>
        
        {filteredNotes.length > 0 ? (
          <motion.div 
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredNotes.slice(0, 5).map((note) => (
              <motion.div
                key={note.id}
                variants={itemVariants}
                whileHover={{ x: 4 }}
                onClick={() => navigate(`/${note.id}`)}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${
                  theme === 'dark' 
                    ? 'bg-gray-800 hover:bg-gray-700' 
                    : 'bg-white hover:bg-gray-50'
                } border border-gray-200 dark:border-gray-700`}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-medium mb-1 truncate flex-1">
                    {note.title || 'Untitled'}
                  </h3>
                  <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                    {note.updatedAt 
                      ? format(new Date(note.updatedAt), 'MMM d')
                      : 'Today'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {note.content?.replace(/[#*_\[\]`]/g, '') || 'No content'}
                </p>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery 
                ? 'No notes match your search.'
                : 'No notes yet. Create your first note to get started.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleNewNote}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create Note
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
