import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { $createAudioBlockNode } from '../nodes/AudioBlockNode';
import { v4 as uuidv4 } from 'uuid';

// Define a custom command for inserting audio blocks
export const INSERT_AUDIO_BLOCK_COMMAND: LexicalCommand<{
  audioSrc: string;
  blockId: string;
  startTime: number;
  recordingId: string;
}> = createCommand('INSERT_AUDIO_BLOCK_COMMAND');

interface AudioBlockPluginProps {
  isRecording: boolean;
  currentRecordingId: string | null;
}

export default function AudioBlockPlugin({
  isRecording,
  currentRecordingId
}: AudioBlockPluginProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // This effect handles the insertion of audio blocks when recording starts
    if (isRecording && currentRecordingId) {
      // When recording starts, we want to insert an audio block at the current cursor position
      editor.update(() => {
        const selection = $getSelection();
        
        if ($isRangeSelection(selection)) {
          const blockId = `block-${uuidv4()}`;
          const audioSrc = `recording://${currentRecordingId}`; // This is a placeholder path
          const startTime = Date.now();
          
          // Create and insert the audio block node
          const audioBlockNode = $createAudioBlockNode(
            audioSrc,
            blockId,
            0, // Start time within the recording (0 for beginning)
            currentRecordingId
          );
          
          selection.insertNodes([audioBlockNode]);
        }
      });
    }
  }, [isRecording, currentRecordingId, editor]);

  useEffect(() => {
    // Register command listener for inserting audio blocks
    return editor.registerCommand(
      INSERT_AUDIO_BLOCK_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          
          if ($isRangeSelection(selection)) {
            const { audioSrc, blockId, startTime, recordingId } = payload;
            const audioBlockNode = $createAudioBlockNode(
              audioSrc,
              blockId,
              startTime,
              recordingId
            );
            
            selection.insertNodes([audioBlockNode]);
          }
        });
        
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}

