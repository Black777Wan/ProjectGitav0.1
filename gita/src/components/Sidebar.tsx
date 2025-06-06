import React, { useState } from 'react';
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
}

const Sidebar: React.FC<SidebarProps> = ({
  onNewNote,
  onDailyNote,
  onSelectNote,
  onOpenSettings,
  onShowAudioRecordings,
  notes,
  selectedNoteId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [foldersExpanded, setFoldersExpanded] = useState<Record<string, boolean>>({
    'notes': true,
  });

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
    <div className="h-screen flex flex-col bg-obsidian-sidebar border-r border-obsidian-border">
      {/* Sidebar header */}
      <div className="p-2 border-b border-obsidian-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-obsidian-text">Obsidian Replica</h1>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-obsidian-bg text-obsidian-text text-sm px-3 py-1.5 rounded border border-obsidian-border focus:border-obsidian-accent focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FiSearch className="absolute right-2 top-2 text-obsidian-muted" />
        </div>
      </div>

      {/* Sidebar actions */}
      <div className="flex p-1 border-b border-obsidian-border">
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
            className="flex items-center px-2 py-1 text-sm text-obsidian-muted hover:text-obsidian-text cursor-pointer"
            onClick={() => toggleFolder('notes')}
          >
            {foldersExpanded['notes'] ? <FiChevronDown className="mr-1" /> : <FiChevronRight className="mr-1" />}
            <FiFolder className="mr-1" />
            <span>Notes</span>
          </div>
          
          {foldersExpanded['notes'] && (
            <div className="ml-4">
              {filteredNotes.length === 0 ? (
                <div className="px-3 py-2 text-sm text-obsidian-muted">
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
                        <div className="text-sm font-medium truncate">{note.title}</div>
                        <div className="text-xs text-obsidian-muted truncate">{note.path}</div>
                      </div>
                      
                      {onShowAudioRecordings && (
                        <button
                          className="p-1 text-obsidian-muted hover:text-obsidian-accent"
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
      <div className="p-2 border-t border-obsidian-border">
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

