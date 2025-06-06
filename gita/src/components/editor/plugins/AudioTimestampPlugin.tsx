import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getRoot, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { createAudioBlockReference } from '../../../api/audio';
import { $isAudioBlockNode } from '../nodes/AudioBlockNode';

// Define a custom command for creating audio timestamp references
export const CREATE_AUDIO_TIMESTAMP_COMMAND: LexicalCommand<{
  blockId: string;
  audioOffsetMs: number;
}> = createCommand('CREATE_AUDIO_TIMESTAMP_COMMAND');

interface AudioTimestampPluginProps {
  isRecording: boolean;
  currentRecordingId: string | null;
}

export default function AudioTimestampPlugin({
  isRecording,
  currentRecordingId
}: AudioTimestampPluginProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command listener for creating audio timestamp references
    return editor.registerCommand(
      CREATE_AUDIO_TIMESTAMP_COMMAND,
      (payload) => {
        if (!isRecording || !currentRecordingId) {
          return false;
        }

        const { blockId, audioOffsetMs } = payload;
        
        // Create an audio block reference in the database
        createAudioBlockReference(currentRecordingId, blockId, audioOffsetMs)
          .then((reference) => {
            console.log('Created audio block reference:', reference);
            
            // Update the editor state to reflect the new reference
            editor.update(() => {
              // Find all audio block nodes that match the current recording
              const root = $getRoot();
              const children = root.getChildren();
              
              for (const child of children) {
                if ($isAudioBlockNode(child) && child.__recordingId === currentRecordingId) {
                  // Update the audio block node with the new timestamp
                  // This is a simplified example - in a real app, you might want to handle multiple timestamps
                  child.__startTime = audioOffsetMs;
                }
              }
            });
          })
          .catch((error) => {
            console.error('Failed to create audio block reference:', error);
          });
        
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor, isRecording, currentRecordingId]);

  return null;
}

