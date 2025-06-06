import React from 'react';
import { FileInfo } from '../types';
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react';
import clsx from 'clsx';

interface FileTreeProps {
  files: FileInfo[];
  currentFile: string | null;
  onFileSelect: (path: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ files, currentFile, onFileSelect }) => {
  const [expandedFolders, setExpandedFolders] = React.useState<Record<string, boolean>>({});

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const renderFileTree = (items: FileInfo[], level = 0) => {
    return items.map(item => {
      const isExpanded = expandedFolders[item.path] || false;
      const isActive = currentFile === item.path;
      
      return (
        <div key={item.path} style={{ paddingLeft: `${level * 12}px` }}>
          <div 
            className={clsx(
              'file-tree-item flex items-center py-1 px-2 rounded-md my-0.5',
              isActive && 'active'
            )}
            onClick={() => {
              if (item.is_directory) {
                toggleFolder(item.path);
              } else {
                onFileSelect(item.path);
              }
            }}
          >
            {item.is_directory ? (
              <>
                {isExpanded ? (
                  <ChevronDown size={16} className="mr-1" />
                ) : (
                  <ChevronRight size={16} className="mr-1" />
                )}
                <Folder size={16} className="mr-1" />
                <span>{item.name}</span>
              </>
            ) : (
              <>
                <File size={16} className="mr-1" />
                <span>{item.name}</span>
              </>
            )}
          </div>
          
          {item.is_directory && isExpanded && item.children && (
            <div className="pl-2">
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="file-tree overflow-auto h-full">
      {renderFileTree(files)}
    </div>
  );
};

export default FileTree;
