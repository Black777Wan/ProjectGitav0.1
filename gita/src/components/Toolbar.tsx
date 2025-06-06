import React from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { RefreshCw, Calendar, Folder } from 'lucide-react';
import AudioControls from './AudioControls';
import { open } from '@tauri-apps/api/dialog';

const Toolbar: React.FC = () => {
  const { 
    refreshFiles, 
    createDailyNote,
    vaultPath,
    setVaultPath,
    isLoading
  } = useFileSystem();

  const handleRefresh = () => {
    refreshFiles();
  };

  const handleCreateDailyNote = () => {
    createDailyNote();
  };
  const handleSelectVault = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Vault Directory'
      });
      
      if (selected && typeof selected === 'string') {
        setVaultPath(selected);
      }
    } catch (err) {
      console.error('Error selecting vault:', err);
    }
  };

  return (
    <div className="flex items-center justify-between p-2 bg-bg-secondary border-b border-gray-700">
      <div className="flex items-center space-x-2">
        <button 
          className="audio-button"
          onClick={handleSelectVault}
          title="Select Vault"
        >
          <Folder size={16} />
        </button>
        
        <button 
          className="audio-button"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh Files"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
        
        <button 
          className="audio-button"
          onClick={handleCreateDailyNote}
          disabled={!vaultPath || isLoading}
          title="Create Daily Note"
        >
          <Calendar size={16} />
        </button>
      </div>
      
      <div className="text-sm truncate max-w-md">
        {vaultPath ? (
          <span className="text-text-muted">{vaultPath}</span>
        ) : (
          <span className="text-text-muted italic">No vault selected</span>
        )}
      </div>
      
      <AudioControls />
    </div>
  );
};

export default Toolbar;
