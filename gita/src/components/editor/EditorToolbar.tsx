import React from 'react'; // Keep React import
import { 
  FiBold, 
  FiItalic, 
  FiCode, 
  FiList, 
  FiLink, 
  FiType,
  FiHash,
  FiFileText,
  FiCheckSquare,
  // FiMic, // Not used directly, isRecordingActive triggers FiPlay/FiStop
  FiPlay, 
  FiSquare
} from 'react-icons/fi';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { useAudioRecordingStore } from "../../stores/audioRecordingStore";
import { useEffect, useRef } from "react"; // Keep from jules_wip (useState removed)
import { getAudioDirectory } from '../../api/fileSystem'; // Keep from jules_wip
import {
  FORMAT_TEXT_COMMAND,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode } from '@lexical/rich-text';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { INSERT_BLOCK_REFERENCE_COMMAND } from './plugins/BlockReferencePlugin';


interface EditorToolbarProps {
  currentNoteId: string;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ currentNoteId }) => {
  const [editor] = useLexicalComposerContext();
  const {
    isRecordingActive,
    recordingStartTimeClient,
    currentRecordingOffsetMs,
    actions: storeActions
  } = useAudioRecordingStore();

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentRecordingIdFromStore = useAudioRecordingStore((state) => state.currentRecordingId);

  // Timer effect
  useEffect(() => {
    if (isRecordingActive && recordingStartTimeClient) {
      recordingIntervalRef.current = setInterval(() => {
        const offset = Date.now() - recordingStartTimeClient;
        storeActions.setOffsetMs(offset);
      }, 250); 
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [isRecordingActive, recordingStartTimeClient, storeActions]);


  const handleToggleRecording = async () => {
    if (!isRecordingActive) {
      // Start recording (jules_wip version)
      const newRecordingId = uuidv4();
      try {
        const audioDir = await getAudioDirectory();
        // The backend saves as audio_dir/{recording_id}.wav (or other format based on backend)
        // This path is anticipated for use by other components (e.g. AudioBlockNode via store)
        // Ensure the extension matches what the backend actually saves. Assuming .wav for now.
        const anticipatedFilePath = `${audioDir}/${newRecordingId}.wav`; 

        console.log(`Starting recording for note: ${currentNoteId}, recordingId: ${newRecordingId}, anticipated path: ${anticipatedFilePath}`);
        await invoke('start_recording', { noteId: currentNoteId, recordingId: newRecordingId });
        storeActions.startRecording(newRecordingId, anticipatedFilePath); // Pass filePath to store
      } catch (err) {
        console.error('Failed to start recording:', err);
        // TODO: Show error to user, maybe reset UI state if start failed critically
      }
    } else {
      // Stop recording
      if (currentRecordingIdFromStore) {
        try {
          console.log(`Stopping recording for recordingId: ${currentRecordingIdFromStore}`);
          await invoke('stop_recording', { recordingId: currentRecordingIdFromStore });
          storeActions.stopRecording();
        } catch (err) {
          console.error('Failed to stop recording:', err);
          // TODO: Show error to user
        }
      } else {
        console.warn("Stop recording called but no currentRecordingId in store.");
        storeActions.stopRecording(); // Fallback to stop client state
      }
    }
  };

  const formatRecordingTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const formatCode = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
  };

  const formatBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const formatNumberList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  const formatHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
    const tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(tag));
      }
    });
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }
  };

  const insertCheckList = () => {
    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
  };

  // Single version of insertBlockReference
  const insertBlockReference = () => {
    const blockId = prompt("Enter Block ID to reference (e.g., b_12345):");
    if (!blockId) return;

    const noteId = prompt("Enter Note ID of the block (optional, defaults to current note if handled by plugin):") || "";
    const previewText = prompt("Enter preview text for the reference (optional):") || `Ref: ${noteId ? noteId + "#" : ""}${blockId}`;

    editor.dispatchCommand(INSERT_BLOCK_REFERENCE_COMMAND, { blockId, noteId, previewText });
  };

  return (
    <div className="flex items-center justify-between p-2 border-b border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg text-light-text dark:text-obsidian-text">
      <div className="flex space-x-1">
        <button 
          onClick={formatBold}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Bold"
        >
          <FiBold />
        </button>
        <button 
          onClick={formatItalic}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Italic"
        >
          <FiItalic />
        </button>
        <button 
          onClick={formatCode}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Code"
        >
          <FiCode />
        </button>

        <div className="border-r border-light-border dark:border-obsidian-border mx-1 h-6"></div>

        <button 
          onClick={formatBulletList}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Bullet List"
        >
          <FiList />
        </button>
        <button 
          onClick={formatNumberList}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Numbered List"
        >
          {/* Using a different icon or style for numbered list might be better UX wise */}
          <FiList style={{ transform: 'scaleY(-1)' }} /> {/* Basic way to differentiate, consider specific icon */}
        </button>
        <button 
          onClick={() => formatHeading(1)}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Heading 1"
        >
          <FiType />
        </button>
        <button 
          onClick={() => formatHeading(2)}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Heading 2"
        >
          <FiHash />
        </button>
        
        <div className="border-r border-light-border dark:border-obsidian-border mx-1 h-6"></div>

        <button 
          onClick={insertLink}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Insert Link"
        >
          <FiLink />
        </button>
        <button 
          onClick={insertBlockReference}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Insert Block Reference"
        >
          <FiFileText />
        </button>
        <button 
          onClick={insertCheckList}
          className="p-1.5 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover"
          title="Insert Task"
        >
          <FiCheckSquare />
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {isRecordingActive && (
          <span className="text-sm text-light-muted dark:text-obsidian-muted font-mono tabular-nums">
            {formatRecordingTime(currentRecordingOffsetMs)}
          </span>
        )}
        <button
          onClick={handleToggleRecording}
          className={`p-1.5 rounded ${
            isRecordingActive
              ? 'bg-red-600 text-white hover:bg-red-700'
              // For non-active, use theme-aware accent
              : 'bg-light-accent dark:bg-obsidian-accent text-white hover:opacity-90' 
          }`}
          title={isRecordingActive ? "Stop Recording" : "Start Recording"}
        >
          {isRecordingActive ? <FiSquare /> : <FiPlay />}
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
