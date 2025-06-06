import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { useAudio } from '../../contexts/AudioContext';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { $getRoot, $getSelection, $createParagraphNode, $createTextNode } from 'lexical';
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown';
import { FiMic, FiMicOff, FiPlay, FiPause, FiSkipBack, FiSkipForward } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

type EditorProps = {
  noteId: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  autoFocus?: boolean;
};

// Editor theme
const theme = {
  ltr: 'text-left',
  rtl: 'text-right',
  paragraph: 'm-0 mb-4 relative',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underlined-line-through',
  },
  link: 'text-blue-600 dark:text-blue-400 underline cursor-pointer',
  heading: {
    h1: 'text-3xl font-bold my-4',
    h2: 'text-2xl font-bold my-3',
    h3: 'text-xl font-bold my-2',
    h4: 'text-lg font-bold my-1',
    h5: 'text-base font-bold my-1',
    h6: 'text-sm font-bold my-1',
  },
  list: {
    nested: {
      listitem: 'list-none',
    },
    ol: 'list-decimal pl-6 my-2',
    ul: 'list-disc pl-6 my-2',
    listitem: 'my-1',
  },
  code: 'bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 font-mono text-sm',
  codeHighlight: {
    atrule: 'text-purple-500',
    attr: 'text-green-500',
    boolean: 'text-blue-500',
    builtin: 'text-yellow-500',
    cdata: 'text-gray-500',
    char: 'text-yellow-500',
    class: 'text-blue-500',
    'class-name': 'text-blue-500',
    comment: 'text-gray-500 italic',
    constant: 'text-blue-500',
    deleted: 'text-red-500',
    doctype: 'text-gray-500',
    entity: 'text-red-500',
    function: 'text-blue-500',
    important: 'text-red-500',
    inserted: 'text-green-500',
    keyword: 'text-purple-500',
    namespace: 'text-gray-500',
    number: 'text-yellow-500',
    operator: 'text-gray-500',
    prolog: 'text-gray-500',
    property: 'text-blue-500',
    punctuation: 'text-gray-500',
    regex: 'text-yellow-500',
    selector: 'text-green-500',
    string: 'text-green-500',
    symbol: 'text-yellow-500',
    tag: 'text-red-500',
    url: 'text-blue-500',
    variable: 'text-red-500',
  },
};

// Lexical nodes
const editorConfig = {
  namespace: 'NoteEditor',
  theme,
  onError(error: Error) {
    console.error(error);
  },
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    AutoLinkNode,
    LinkNode,
  ],
};

// Custom plugins
function Placeholder() {
  return (
    <div className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none">
      Start writing...
    </div>
  );
}

function EditorToolbar() {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Formatting buttons would go here */}
      <div className="flex items-center space-x-1">
        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Bold">
          <span className="font-bold">B</span>
        </button>
        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Italic">
          <span className="italic">I</span>
        </button>
        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Underline">
          <span className="underline">U</span>
        </button>
      </div>
    </div>
  );
}

function AudioControls({ isRecording, onRecord, onPlay, isPlaying, onSeek, currentTime, duration }) {
  const [isHovered, setIsHovered] = useState(false);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all duration-300"
      style={{ width: isHovered ? '300px' : '48px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center p-2">
        <button
          onClick={onRecord}
          className={`p-2 rounded-full ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'} hover:opacity-90 transition-colors`}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? <FiMicOff size={18} /> : <FiMic size={18} />}
        </button>
        
        {isHovered && (
          <div className="flex-1 ml-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-center mt-2 space-x-4">
              <button 
                onClick={() => onSeek(-5)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Rewind 5 seconds"
              >
                <FiSkipBack size={16} />
              </button>
              <button 
                onClick={onPlay}
                className="p-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
              </button>
              <button 
                onClick={() => onSeek(5)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Forward 5 seconds"
              >
                <FiSkipForward size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function NoteEditor({ noteId, initialContent = '', onContentChange, autoFocus = true }: EditorProps) {
  const { updateNote, getNote } = useNotes();
  const { 
    isRecording, 
    isPlaying, 
    currentTime, 
    duration, 
    startRecording, 
    stopRecording, 
    playAudio, 
    pauseAudio,
    addAudioTimestamp,
    getAudioTimestamps
  } = useAudio();
  
  const [content, setContent] = useState(initialContent);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [audioTimestamps, setAudioTimestamps] = useState<Array<{id: string, startTime: number, endTime: number}>>([]);
  
  const editorRef = useRef(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Load note content and audio timestamps
  useEffect(() => {
    const loadNote = async () => {
      if (noteId) {
        const note = getNote(noteId);
        if (note) {
          setContent(note.content || '');
          const timestamps = getAudioTimestamps(noteId);
          setAudioTimestamps(timestamps);
        }
      }
      setIsEditorReady(true);
    };
    
    loadNote();
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [noteId, getNote, getAudioTimestamps]);
  
  // Save note with debounce
  const handleContentChange = useCallback((editorState: any) => {
    if (!isEditorReady) return;
    
    editorState.read(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS);
      setContent(markdown);
      setIsDirty(true);
      
      // Debounce the save operation
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(async () => {
        if (noteId) {
          await updateNote(noteId, { content: markdown });
          setIsDirty(false);
          
          if (onContentChange) {
            onContentChange(markdown);
          }
        }
      }, 1000);
    });
  }, [isEditorReady, noteId, onContentChange, updateNote]);
  
  // Handle recording
  const handleRecord = async () => {
    if (isRecording) {
      await stopRecording();
    } else if (noteId) {
      await startRecording(noteId);
    }
  };
  
  // Handle playback
  const handlePlay = () => {
    // Implementation would depend on your audio handling
    console.log('Play/pause audio');
  };
  
  // Handle seeking
  const handleSeek = (seconds: number) => {
    // Implementation would depend on your audio handling
    console.log('Seek', seconds);
  };
  
  // Add audio timestamp at current cursor position
  const addTimestamp = async () => {
    if (!noteId || !isRecording) return;
    
    // In a real implementation, you would get the current cursor position
    // and create a block reference there
    const blockId = `block-${Date.now()}`;
    const startTime = currentTime;
    const endTime = startTime + 5; // 5-second clip by default
    
    await addAudioTimestamp(noteId, blockId, `recording-${Date.now()}.wav`, startTime, endTime);
    
    // Update local state
    setAudioTimestamps(prev => [...prev, { id: blockId, startTime, endTime }]);
  };
  
  // Initial content for the editor
  const initialConfig = {
    ...editorConfig,
    editorState: (editor: any) => {
      // Set initial content
      if (content) {
        $convertFromMarkdownString(content, TRANSFORMERS);
      } else {
        const root = $getRoot();
        if (root.getFirstChild() === null) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(''));
          root.append(paragraph);
        }
      }
    },
  };

  if (!isEditorReady) {
    return <div className="p-4 text-gray-500">Loading editor...</div>;
  }

  return (
    <div className="relative h-full bg-white dark:bg-gray-900">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="border rounded-lg overflow-hidden h-full flex flex-col">
          <EditorToolbar />
          <div className="relative flex-1 overflow-auto">
            <RichTextPlugin
              contentEditable={
                <ContentEditable 
                  className="min-h-[calc(100vh-200px)] p-4 focus:outline-none"
                />
              }
              placeholder={<Placeholder />}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <LinkPlugin />
            <ListPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            
            {/* Render audio timestamps as blocks */}
            <div className="px-4 pb-4">
              {audioTimestamps.map((timestamp) => (
                <div 
                  key={timestamp.id}
                  className="flex items-center p-3 my-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <button 
                    onClick={() => playAudio(`audio-${timestamp.id}.wav`, timestamp.startTime)}
                    className="p-2 mr-3 text-blue-500 bg-blue-100 dark:bg-blue-900/30 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800/50"
                  >
                    <FiPlay size={16} />
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Audio Clip
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatTime(timestamp.startTime)} - {formatTime(timestamp.endTime)}</span>
                      <span className="mx-2">•</span>
                      <span>{formatTime(timestamp.endTime - timestamp.startTime)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-2 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 dark:text-gray-400">
            <div className="flex items-center justify-between">
              <span>{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <span>Markdown supported</span>
            </div>
          </div>
        </div>
        
        {/* Audio controls */}
        <AudioControls
          isRecording={isRecording}
          onRecord={handleRecord}
          onPlay={handlePlay}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
        />
      </LexicalComposer>
    </div>
  );
}
