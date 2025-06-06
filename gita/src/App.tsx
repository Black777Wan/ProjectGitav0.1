import React, { useEffect, useState } from 'react';
import { FileSystemProvider, useFileSystem } from './contexts/FileSystemContext';
import { AudioProvider } from './contexts/AudioContext';
import FileTree from './components/FileTree';
import Editor from './components/Editor';
import Backlinks from './components/Backlinks';
import Toolbar from './components/Toolbar';
import { open } from '@tauri-apps/api/dialog';

// Main application content
const AppContent: React.FC = () => {
  const { 
    files, 
    currentFile, 
    fileContent, 
    setCurrentFile, 
    saveContent, 
    vaultPath, 
    setVaultPath 
  } = useFileSystem();
  const [rightPaneVisible, setRightPaneVisible] = useState(true);
    // Prompt for vault selection if not set
  useEffect(() => {
    const selectVault = async () => {
      if (!vaultPath) {
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
      }
    };
    
    selectVault();
  }, [vaultPath, setVaultPath]);

  const handleEditorChange = (content: string) => {
    saveContent(content);
  };

  const toggleRightPane = () => {
    setRightPaneVisible(!rightPaneVisible);
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-normal">
      <Toolbar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane - File tree */}
        <div className="w-64 p-2 border-r border-gray-700 overflow-auto">
          <FileTree 
            files={files} 
            currentFile={currentFile}
            onFileSelect={setCurrentFile}
          />
        </div>
        
        {/* Center pane - Editor */}
        <div className="flex-1 p-4 overflow-auto">
          {currentFile ? (
            <Editor 
              content={fileContent} 
              onChange={handleEditorChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              Select a file or create a new one to start editing
            </div>
          )}
        </div>
        
        {/* Right pane - Backlinks */}
        {rightPaneVisible && (
          <div className="w-64 border-l border-gray-700 overflow-auto">
            <Backlinks />
          </div>
        )}
      </div>
    </div>
  );
};

// Main App component with providers
function App() {
  return (
    <FileSystemProvider>
      <AudioProvider>
        <AppContent />      </AudioProvider>
    </FileSystemProvider>
  );
}

export default App;
