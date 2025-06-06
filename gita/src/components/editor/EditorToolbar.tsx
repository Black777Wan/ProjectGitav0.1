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
  FiMic,
  FiPlay, // For Record button
  FiStop  // For Stop button
} from 'react-icons/fi';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { invoke } from '@tauri-apps/api/tauri';
import { v4 as uuidv4 } from 'uuid';
import { useAudioRecordingStore } from '../../../stores/audioRecordingStore';
import { useEffect, useRef, useState } from 'react'; // Added useEffect, useRef, useState
import {
  FORMAT_TEXT_COMMAND,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND, // Added for task lists
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode } from '@lexical/rich-text';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';

// Assuming custom command path - user will need to verify/adjust
// If BlockReferencePlugin.tsx exports it:
import { INSERT_BLOCK_REFERENCE_COMMAND } from '../plugins/BlockReferencePlugin';
// Or if it's in a central commands file:
// import { INSERT_BLOCK_REFERENCE_COMMAND } from '../commands';


interface EditorToolbarProps {
  // isRecording is now from Zustand store
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
      }, 250); // Update every 250ms for smoother display
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
    // Cleanup interval on component unmount or when recording stops
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [isRecordingActive, recordingStartTimeClient, storeActions]);


  const handleToggleRecording = async () => {
    if (!isRecordingActive) {
      // Start recording
      const newRecordingId = uuidv4();
      try {
        console.log(`Starting recording for note: ${currentNoteId}, recordingId: ${newRecordingId}`);
        await invoke('start_recording', { noteId: currentNoteId, recordingId: newRecordingId });
        storeActions.startRecording(newRecordingId);
      } catch (err) {
        console.error('Failed to start recording:', err);
        // TODO: Show error to user
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
        // Fallback to stop client state if backend somehow failed to start or ID was lost
        storeActions.stopRecording();
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

  const insertBlockReference = () => {
    const blockId = prompt("Enter Block ID to reference (e.g., b_12345):");
    if (!blockId) return;

    const noteId = prompt("Enter Note ID of the block (optional, defaults to current note if handled by plugin):") || "";
    const previewText = prompt("Enter preview text for the reference (optional):") || `Ref: ${noteId ? noteId + "#" : ""}${blockId}`;

    // The payload type { blockId: string, noteId: string, previewText: string }
    // should match what INSERT_BLOCK_REFERENCE_COMMAND expects.
    // If noteId is empty, the plugin might default to the current note or handle it.
    editor.dispatchCommand(INSERT_BLOCK_REFERENCE_COMMAND, { blockId, noteId, previewText });
  };

  // const createAudioTimestamp = () => { // This function is now obsolete
  //   if (!isRecordingActive) return;
  //   console.log('Create audio timestamp');
  // };
  
  return (
    <div className="flex items-center justify-between p-2 border-b border-obsidian-border bg-obsidian-bg">
      <div className="flex space-x-1">
        {/* Existing formatting buttons */}
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
          {/* Using FiHash for H2, could use a different icon or text for H3 etc. */}
          <FiHash />
        </button>
        {/* Example for H3 if needed
        <button
          onClick={() => formatHeading(3)}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Heading 3"
        >
          H3
        </button>
        */}
        
        <div className="border-r border-obsidian-border mx-1 h-6"></div>
        
        <button 
          onClick={insertLink}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Insert Link"
        >
          <FiLink />
        </button>
        <button 
          onClick={insertBlockReference}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Insert Block Reference"
        >
          <FiFileText />
        </button>
        <button 
          onClick={insertCheckList}
          className="p-1.5 rounded hover:bg-obsidian-hover"
          title="Insert Task"
        >
          <FiCheckSquare />
        </button>
      </div>

      {/* Recording Controls Area */}
      <div className="flex items-center space-x-2">
        {isRecordingActive && (
          <span className="text-sm text-obsidian-muted font-mono">
            {formatRecordingTime(currentRecordingOffsetMs)}
          </span>
        )}
        <button
          onClick={handleToggleRecording}
          className={`p-1.5 rounded ${
            isRecordingActive
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700' // Or just hover:bg-obsidian-hover for non-active
          }`}
          title={isRecordingActive ? "Stop Recording" : "Start Recording"}
        >
          {isRecordingActive ? <FiStop /> : <FiPlay />} {/* Using FiPlay for record start */}
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;

