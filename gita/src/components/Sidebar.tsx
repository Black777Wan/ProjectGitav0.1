import React, { useState, useRef, useEffect } from 'react';
import { 
  FiFileText, 
  FiCalendar, 
  FiSearch, 
  FiSettings, 
  FiPlus,
  FiFolder,
  FiChevronDown,
  FiChevronRight,
  FiMusic
} from 'react-icons/fi';

interface SidebarProps {
  onNewNote: () => void;
  onDailyNote: () => void;
  onSelectNote: (noteId: string) => void;
  onOpenSettings: () => void;
  onShowAudioRecordings?: (noteId: string) => void;
  notes: { id: string; title: string; path: string }[];
  selectedNoteId: string | null;
  /** Prop to trigger focus on the search input, typically activated by App.tsx via Ctrl+F. */
  focusSearchInput?: boolean;
  /** Callback invoked after the search input has been successfully focused. */
  onSearchFocused?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onNewNote,
  onDailyNote,
  onSelectNote,
  onOpenSettings,
  onShowAudioRecordings,
  notes,
  selectedNoteId,
  focusSearchInput,
  onSearchFocused,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [foldersExpanded, setFoldersExpanded] = useState<Record<string, boolean>>({
    'notes': true, // Default 'notes' folder to expanded
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Effect to focus the search input when `focusSearchInput` prop is true.
   * This is typically triggered by a global keyboard shortcut (e.g., Ctrl+F) handled in App.tsx.
   * After focusing, it calls `onSearchFocused` to notify the parent (App.tsx)
   * that the focus request has been handled, allowing the parent to reset the trigger state.
   */
  useEffect(() => {
    if (focusSearchInput && searchInputRef.current) {
      searchInputRef.current.focus();
      if (onSearchFocused) {
        onSearchFocused();
      }
    }
  }, [focusSearchInput, onSearchFocused]); // Depends on the trigger prop and the callback.

  const toggleFolder = (folderId: string) => {
    setFoldersExpanded(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const filteredNotes = searchQuery
    ? notes.filter(note => note.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : notes;

  return (
    <div className="h-screen flex flex-col bg-light-sidebar dark:bg-obsidian-sidebar border-r border-light-border dark:border-obsidian-border">
      {/* Sidebar header */}
      <div className="p-2 border-b border-light-border dark:border-obsidian-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-light-text dark:text-obsidian-text">Obsidian Replica</h1>
        </div>
        <div className="relative">
          <input
            ref={searchInputRef} // Assign ref
            type="text"
            placeholder="Search..."
            className="input w-full text-sm px-3 py-1.5" /* Use .input class from index.css */
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FiSearch className="absolute right-2 top-2 text-light-muted dark:text-obsidian-muted" />
        </div>
      </div>

      {/* Sidebar actions */}
      <div className="flex p-1 border-b border-light-border dark:border-obsidian-border">
        <button 
          className="sidebar-item flex-1"
          onClick={onNewNote}
        >
          <FiFileText className="mr-1" /> New
        </button>
        <button 
          className="sidebar-item flex-1"
          onClick={onDailyNote}
        >
          <FiCalendar className="mr-1" /> Daily
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          <div 
            className="flex items-center px-2 py-1 text-sm text-light-muted dark:text-obsidian-muted hover:text-light-text dark:hover:text-obsidian-text cursor-pointer"
            onClick={() => toggleFolder('notes')}
          >
            {foldersExpanded['notes'] ? <FiChevronDown className="mr-1" /> : <FiChevronRight className="mr-1" />}
            <FiFolder className="mr-1" />
            <span>Notes</span>
          </div>
          
          {foldersExpanded['notes'] && (
            <div className="ml-4">
              {filteredNotes.length === 0 ? (
                <div className="px-3 py-2 text-sm text-light-muted dark:text-obsidian-muted">
                  {searchQuery ? 'No matching notes' : 'No notes yet'}
                </div>
              ) : (
                filteredNotes.map(note => (
                  <div
                    key={note.id}
                    className={`note-list-item ${selectedNoteId === note.id ? 'active' : ''}`}
                  >
                    <div 
                      className="flex items-center justify-between"
                      onClick={() => onSelectNote(note.id)}
                    >
                      <div>
                        <div className="text-sm font-medium truncate">{note.title}</div> {/* Inherits themed text color */}
                        <div className="text-xs text-light-muted dark:text-obsidian-muted truncate">{note.path}</div>
                      </div>
                      
                      {onShowAudioRecordings && (
                        <button
                          className="p-1 text-light-muted dark:text-obsidian-muted hover:text-light-accent dark:hover:text-obsidian-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            onShowAudioRecordings(note.id);
                          }}
                          title="Show Audio Recordings"
                        >
                          <FiMusic size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar footer */}
      <div className="p-2 border-t border-light-border dark:border-obsidian-border">
        <button 
          className="sidebar-item w-full"
          onClick={onOpenSettings}
        >
          <FiSettings className="mr-2" /> Settings
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

