import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useFileSystem } from '../contexts/FileSystemContext';
import { BacklinkInfo } from '../types';
import { ArrowLeft } from 'lucide-react';

const Backlinks: React.FC = () => {
  const { currentFile, vaultPath, setCurrentFile } = useFileSystem();
  const [backlinks, setBacklinks] = useState<BacklinkInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBacklinks = async () => {
      if (!currentFile || !vaultPath) return;
      
      setIsLoading(true);
      
      try {
        // Extract the file name from the path
        const fileName = currentFile.split(/[/\\]/).pop() || '';
        const pageName = fileName.replace('.md', '');
        
        const links = await invoke<BacklinkInfo[]>('find_backlinks', { 
          pageName, 
          vaultPath 
        });
        
        setBacklinks(links);
      } catch (err) {
        console.error('Error fetching backlinks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBacklinks();
  }, [currentFile, vaultPath]);

  if (isLoading) {
    return <div className="p-4 text-text-muted">Loading backlinks...</div>;
  }

  if (backlinks.length === 0) {
    return <div className="p-4 text-text-muted">No backlinks found</div>;
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-2">Linked References</h3>
      <div className="space-y-2">
        {backlinks.map((link) => (
          <div 
            key={link.file_path} 
            className="p-2 bg-bg-secondary rounded-md cursor-pointer hover:bg-opacity-70"
            onClick={() => setCurrentFile(link.file_path)}
          >
            <div className="flex items-center text-xs text-text-accent mb-1">
              <ArrowLeft size={12} className="mr-1" />
              {link.file_name}
            </div>
            <div className="text-sm text-text-normal">{link.context}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Backlinks;
