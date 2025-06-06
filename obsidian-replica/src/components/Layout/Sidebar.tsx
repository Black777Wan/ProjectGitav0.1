import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { useSettings } from '../../contexts/SettingsContext';
import { FiFile, FiFolder, FiChevronRight, FiChevronDown, FiPlus, FiSearch, FiStar, FiClock, FiTrash2, FiSettings } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FolderItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: FolderItem[];
  isOpen?: boolean;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { notes } = useNotes();
  const { settings } = useSettings();
  const location = useLocation();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Convert notes to folder structure
  useEffect(() => {
    const rootFolders: FolderItem[] = [];
    const folderMap: Record<string, FolderItem> = {};

    // Add default folders
    const defaultFolders: FolderItem[] = [
      { id: 'all-notes', name: 'All Notes', type: 'folder', path: '', isOpen: true },
      { id: 'favorites', name: 'Favorites', type: 'folder', path: 'favorites', isOpen: true },
      { id: 'recent', name: 'Recent', type: 'folder', path: 'recent', isOpen: true },
      { id: 'trash', name: 'Trash', type: 'folder', path: 'trash', isOpen: true },
    ];

    // Process notes into folder structure
    notes.forEach(note => {
      const pathParts = note.path.split('/').filter(Boolean);
      let currentPath = '';
      let parent: FolderItem | null = null;

      // Find or create folders for the path
      pathParts.forEach((part, index) => {
        const path = currentPath ? `${currentPath}/${part}` : part;
        currentPath = path;

        if (!folderMap[path]) {
          const folder: FolderItem = {
            id: `folder-${path}`,
            name: part,
            type: 'folder',
            path: path,
            isOpen: expandedFolders[path] !== undefined ? expandedFolders[path] : true,
            children: [],
          };

          folderMap[path] = folder;

          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(folder);
          } else {
            // This is a root folder
            if (!rootFolders.some(f => f.path === path)) {
              rootFolders.push(folder);
            }
          }
        }


        parent = folderMap[path];
      });

      // Add note to the appropriate folder
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push({
          id: note.id,
          name: note.title || 'Untitled',
          type: 'file',
          path: note.path,
        });
      } else {
        // If no parent folder, add to root
        rootFolders.push({
          id: note.id,
          name: note.title || 'Untitled',
          type: 'file',
          path: note.path,
        });
      }
    });

    // Merge with default folders
    const allFolders = [...defaultFolders, ...rootFolders];
    setFolders(allFolders);
  }, [notes, expandedFolders]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.pageX;
    const startWidth = sidebarWidth;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.pageX - startX);
      setSidebarWidth(Math.max(200, Math.min(400, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp, { once: true });
  };

  const renderFolder = (folder: FolderItem, depth = 0) => {
    const isExpanded = folder.isOpen !== false;
    const hasChildren = folder.children && folder.children.length > 0;
    const isActive = location.pathname === `/${folder.path}`;

    return (
      <div key={folder.id} className="w-full">
        <div 
          className={`flex items-center px-4 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${isActive ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => hasChildren ? toggleFolder(folder.path) : null}
        >
          {hasChildren ? (
            <button 
              className="mr-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.path);
              }}
            >
              {isExpanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-5" />
          )}
          
          {folder.id === 'favorites' ? (
            <FiStar className="mr-2 text-yellow-500" />
          ) : folder.id === 'recent' ? (
            <FiClock className="mr-2 text-blue-500" />
          ) : folder.id === 'trash' ? (
            <FiTrash2 className="mr-2 text-red-500" />
          ) : folder.id === 'all-notes' ? (
            <FiFile className="mr-2 text-gray-500" />
          ) : (
            <FiFolder className="mr-2 text-blue-500" />
          )}
          
          <span className="truncate">{folder.name}</span>
          
          {folder.type === 'folder' && (
            <button 
              className="ml-auto p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                // Handle new note in folder
                console.log('New note in folder:', folder.path);
              }}
            >
              <FiPlus size={14} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
            </button>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {folder.children?.map(child => 
              child.type === 'folder' 
                ? renderFolder(child, depth + 1)
                : renderNote(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderNote = (note: FolderItem, depth: number) => {
    const isActive = location.pathname === `/${note.id}`;
    
    return (
      <Link
        key={note.id}
        to={`/${note.id}`}
        className={`flex items-center px-4 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${isActive ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 28}px` }}
      >
        <FiFile className="mr-2 text-gray-500" />
        <span className="truncate">{note.name}</span>
      </Link>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-lg"
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Search */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {/* Folders */}
            <div className="flex-1 overflow-y-auto py-2">
              {folders.map(folder => renderFolder(folder))}
            </div>
            
            {/* Settings */}
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <Link
                to="/settings"
                className={`flex items-center px-3 py-2 text-sm rounded-md ${location.pathname === '/settings' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                <FiSettings className="mr-2 text-gray-500" />
                <span>Settings</span>
              </Link>
            </div>
            
            {/* Resize handle */}
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
              onMouseDown={handleResizeStart}
            />
          </motion.div>
          
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black lg:hidden"
            onClick={onClose}
          />
        </>
      )}
    </AnimatePresence>
  );
}
