import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { FiArrowLeft, FiEdit2, FiSave, FiX, FiLink, FiClock, FiTag, FiPlus, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import NoteEditor from '../../components/Editor';
import { format } from 'date-fns';

export default function NoteView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { 
    getNote, 
    updateNote, 
    deleteNote, 
    getBacklinks,
    getNoteTags,
    addTagToNote,
    removeTagFromNote 
  } = useNotes();
  
  const [note, setNote] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [backlinks, setBacklinks] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  // Load note data
  useEffect(() => {
    if (!id) return;
    
    const loadNote = () => {
      const noteData = getNote(id);
      if (noteData) {
        setNote(noteData);
        setTitle(noteData.title || 'Untitled');
        
        // Load backlinks
        const links = getBacklinks(id);
        setBacklinks(links);
        
        // Load tags
        const noteTags = getNoteTags(id);
        setTags(noteTags);
      }
    };
    
    loadNote();
  }, [id, getNote, getBacklinks, getNoteTags]);
  
  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };
  
  // Save note
  const handleSave = async () => {
    if (!id || !title.trim()) return;
    
    setIsSaving(true);
    try {
      await updateNote(id, { title: title.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle content change from editor
  const handleContentChange = async (content: string) => {
    if (!id) return;
    
    try {
      await updateNote(id, { content });
    } catch (error) {
      console.error('Failed to update note content:', error);
    }
  };
  
  // Handle delete note
  const handleDelete = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this note? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteNote(id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };
  
  // Add a new tag
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !newTag.trim()) return;
    
    try {
      await addTagToNote(id, newTag.trim());
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      setShowTagInput(false);
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };
  
  // Remove a tag
  const handleRemoveTag = async (tagToRemove: string) => {
    if (!id) return;
    
    try {
      await removeTagFromNote(id, tagToRemove);
      setTags(tags.filter(tag => tag !== tagToRemove));
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };
  
  // Focus tag input when shown
  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [showTagInput]);
  
  if (!note) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading note...</div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => navigate(-1)} 
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Go back"
            >
              <FiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            
            {isEditing ? (
              <div className="flex-1 flex items-center">
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  className="flex-1 bg-transparent text-xl font-semibold focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    } else if (e.key === 'Escape') {
                      setIsEditing(false);
                      setTitle(note.title || 'Untitled');
                    }
                  }}
                />
              </div>
            ) : (
              <h1 
                className="text-xl font-semibold cursor-pointer"
                onClick={() => setIsEditing(true)}
              >
                {title || 'Untitled'}
              </h1>
            )}
            
            {isEditing ? (
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  disabled={!title.trim() || isSaving}
                  className="p-1.5 text-green-600 dark:text-green-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  aria-label="Save changes"
                >
                  <FiSave className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setTitle(note.title || 'Untitled');
                  }}
                  className="p-1.5 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Cancel"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Edit title"
              >
                <FiEdit2 className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <button
            onClick={handleDelete}
            className="p-1.5 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            aria-label="Delete note"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
        
        {/* Metadata */}
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2">
          <div className="flex items-center mr-4">
            <FiClock className="w-4 h-4 mr-1" />
            <span>
              {note.updatedAt 
                ? format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a') 
                : 'Just now'}
            </span>
          </div>
          
          {note.wordCount && (
            <div className="mr-4">
              {note.wordCount} {note.wordCount === 1 ? 'word' : 'words'}
            </div>
          )}
          
          {note.characterCount && (
            <div>
              {note.characterCount} {note.characterCount === 1 ? 'character' : 'characters'}
            </div>
          )}
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap items-center mt-3 gap-2">
          {tags.map((tag) => (
            <div 
              key={tag} 
              className="flex items-center px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
            >
              <FiTag className="w-3 h-3 mr-1" />
              <span>#{tag}</span>
              <button 
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                aria-label={`Remove tag ${tag}`}
              >
                <FiX className="w-3 h-3" />
              </button>
            </div>
          ))}
          
          {showTagInput ? (
            <form onSubmit={handleAddTag} className="flex items-center">
              <input
                ref={tagInputRef}
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                className="text-xs px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                onBlur={() => {
                  if (!newTag.trim()) {
                    setShowTagInput(false);
                  }
                }}
              />
              <button 
                type="submit" 
                className="ml-1 p-1 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                aria-label="Add tag"
              >
                <FiPlus className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowTagInput(false);
                  setNewTag('');
                }}
                className="ml-0.5 p-1 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                aria-label="Cancel"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              aria-label="Add tag"
            >
              <FiPlus className="w-3 h-3 mr-0.5" />
              <span>Add tag</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Backlinks section */}
      {backlinks.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <h3 className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FiLink className="w-4 h-4 mr-2" />
            Linked to this note
          </h3>
          <div className="space-y-2">
            {backlinks.map((link) => (
              <button
                key={link.id}
                onClick={() => navigate(`/${link.id}`)}
                className="block w-full text-left p-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                {link.title || 'Untitled'}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {id && (
          <NoteEditor 
            noteId={id} 
            initialContent={note.content} 
            onContentChange={handleContentChange}
            autoFocus
          />
        )}
      </div>
    </div>
  );
}
