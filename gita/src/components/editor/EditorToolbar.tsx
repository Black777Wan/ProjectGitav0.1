import React from 'react';
import { 
  FiBold, 
  FiItalic, 
  FiCode, 
  FiList, 
  FiLink, 
  FiAlignLeft,
  FiType,
  FiHash,
  FiFileText,
  FiCheckSquare,
  FiMic
} from 'react-icons/fi';

interface EditorToolbarProps {
  isRecording?: boolean;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ isRecording = false }) => {
  const formatBold = () => {
    // Placeholder for formatting functionality
    console.log('Format bold');
  };
  
  const formatItalic = () => {
    console.log('Format italic');
  };
  
  const formatCode = () => {
    console.log('Format code');
  };
  
  const formatBulletList = () => {
    console.log('Format bullet list');
  };
  
  const formatNumberList = () => {
    console.log('Format number list');
  };
  
  const formatHeading = (level: number) => {
    console.log(`Format heading ${level}`);
  };
  
  const createAudioTimestamp = () => {
    if (!isRecording) return;
    console.log('Create audio timestamp');
  };
  
  return (
    <div className="flex items-center p-2 border-b border-obsidian-border bg-obsidian-bg">
      <div className="flex space-x-1">
        <button 
          onClick={formatBold}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Bold"
        >
          <FiBold />
        </button>
        <button 
          onClick={formatItalic}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Italic"
        >
          <FiItalic />
        </button>
        <button 
          onClick={formatCode}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Code"
        >
          <FiCode />
        </button>
        
        <div className="border-r border-obsidian-border mx-1 h-6"></div>
        
        <button 
          onClick={formatBulletList}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Bullet List"
        >
          <FiList />
        </button>
        <button 
          onClick={formatNumberList}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Numbered List"
        >
          <FiList className="transform rotate-180" />
        </button>
        <button 
          onClick={() => formatHeading(1)}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Heading 1"
        >
          <FiType />
        </button>
        <button 
          onClick={() => formatHeading(2)}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Heading 2"
        >
          <FiHash />
        </button>
        
        <div className="border-r border-obsidian-border mx-1 h-6"></div>
        
        <button 
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Insert Link"
        >
          <FiLink />
        </button>
        <button 
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Insert Block Reference"
        >
          <FiFileText />
        </button>
        <button 
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Insert Task"
        >
          <FiCheckSquare />
        </button>
        
        {isRecording && (
          <>
            <div className="border-r border-obsidian-border mx-1 h-6"></div>
            <button 
              onClick={createAudioTimestamp}
              className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700"
              title="Create Audio Timestamp at Current Position"
            >
              <FiMic />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EditorToolbar;

