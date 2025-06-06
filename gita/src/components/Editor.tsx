import React, { useEffect, useState, useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { EditorState, LexicalEditor } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { PlayCircle } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';
import { invoke } from '@tauri-apps/api/tauri';
import debounce from 'lodash.debounce';

// Simple error boundary component for the Lexical editor
function LexicalErrorBoundary({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}

// Block with audio timestamp plugin
function AudioTimestampPlugin() {
  const [editor] = useLexicalComposerContext();
  const { isRecording, getTimestamp } = useAudio();

  useEffect(() => {
    // Handle block creation for audio timestamps
    const unregister = editor.registerNodeTransform(
      // This is a simplification that accesses internal structures
      // In a production app, you would use proper node type checking
      editor._nodes.get('paragraph'),
      async (node) => {
        // Skip if already has timestamp
        // Using 'any' type here because we're attaching custom properties
        const nodeAny = node as any;
        if (nodeAny.__audioTimestamp) return;
        
        // Skip if not recording
        if (!isRecording) return;
        
        // Get the current timestamp
        const timestamp = await getTimestamp();
        
        // Store timestamp in node metadata
        nodeAny.__audioTimestamp = timestamp;
        
        // Force rerender to show the play button
        editor.update(() => {
          node.markDirty();
        });
      }
    );
    
    return () => {
      unregister();
    };
  }, [editor, isRecording, getTimestamp]);

  return null;
}

// Plugin to add block IDs
function BlockIDPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Handle block creation for IDs
    const unregister = editor.registerNodeTransform(
      // This is a simplification that accesses internal structures
      editor._nodes.get('paragraph'),
      async (node) => {
        // Skip if already has ID
        // Using 'any' type here because we're attaching custom properties
        const nodeAny = node as any;
        if (nodeAny.__blockID) return;
        
        // Generate a block ID
        const blockID = await invoke<string>('generate_block_id');
        
        // Store ID in node metadata
        nodeAny.__blockID = blockID;
      }
    );
    
    return () => {
      unregister();
    };
  }, [editor]);

  return null;
}

// Render audio timestamp buttons
function AudioTimestampButtons() {
  const [editor] = useLexicalComposerContext();
  const { playAudioFromTimestamp } = useAudio();
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [timestampNodes, setTimestampNodes] = useState<{nodeKey: string, timestamp: number}[]>([]);
  
  // Get the current editor state and extract timestamp information
  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const nodes: {nodeKey: string, timestamp: number}[] = [];
        
        // This is a simplified version - in a real implementation,
        // you would properly traverse the node tree
        editor.getEditorState()._nodeMap.forEach((node: any, key: string) => {
          if (node.__audioTimestamp) {
            nodes.push({
              nodeKey: key,
              timestamp: node.__audioTimestamp
            });
          }
        });
        
        setTimestampNodes(nodes);
      });
    });
    
    return () => {
      unregister();
    };
  }, [editor]);
  
  // Listen for audio file changes
  useEffect(() => {
    const findAudioFile = async () => {
      // In a real implementation, you would get this from the metadata file
      // For now, we'll just look for the audio file path in local storage
      const storedAudioFile = localStorage.getItem('currentAudioFile');
      if (storedAudioFile) {
        setAudioFile(storedAudioFile);
      }
    };
    
    findAudioFile();
  }, []);
  
  // This is a simplified implementation
  // In a real app, you would render the timestamp buttons in the correct positions
  return (
    <div className="timestamp-buttons">
      {timestampNodes.map(node => (
        <button 
          key={node.nodeKey}
          className="timestamp-button"
          onClick={() => audioFile && playAudioFromTimestamp(audioFile, node.timestamp)}
        >
          <PlayCircle size={16} />
          {(node.timestamp / 1000).toFixed(1)}s
        </button>
      ))}
    </div>
  );
}

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
}

const Editor: React.FC<EditorProps> = ({ content, onChange }) => {
  // Initial editor configuration
  const initialConfig = {
    namespace: 'gita-editor',
    theme: {
      paragraph: 'mb-2',
      heading: {
        h1: 'text-2xl font-bold mb-4',
        h2: 'text-xl font-bold mb-3',
        h3: 'text-lg font-bold mb-2',
      },
      list: {
        ul: 'list-disc ml-5 mb-2',
        ol: 'list-decimal ml-5 mb-2',
        listitem: 'mb-1',
      },
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        code: 'bg-gray-800 px-1 py-0.5 rounded text-sm font-mono',
      },
    },
    onError(error: Error) {
      console.error(error);
    },
  };

  // Debounced onChange handler
  const debouncedOnChange = useCallback(
    debounce((editorState: EditorState, editor: LexicalEditor) => {
      editorState.read(() => {
        const editorJSON = editor.toJSON();
        // Convert JSON to Markdown or appropriate format
        // For now, just use a simplified approach
        onChange(JSON.stringify(editorJSON));
      });
    }, 500),
    [onChange]
  );  return (
    <div className="editor-container">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={<ContentEditable className="outline-none h-full" />}
            placeholder={<div className="absolute top-[1rem] left-[1rem] opacity-50">Start typing...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <OnChangePlugin onChange={debouncedOnChange} />
          <HistoryPlugin />
          <MarkdownShortcutPlugin />
          <AudioTimestampPlugin />
          <BlockIDPlugin />
          <AudioTimestampButtons />
        </div>
      </LexicalComposer>
    </div>
  );
};

export default Editor;
