import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { $createAudioBlockNode } from '../nodes/AudioBlockNode';
import { v4 as uuidv4 } from 'uuid';

// Define a custom command for inserting audio blocks
export const INSERT_AUDIO_BLOCK_COMMAND: LexicalCommand<{
  audioFilePath: string; // Changed from audioSrc
  recordingId: string;
  blockId?: string; // blockId is now optional, can be generated
  startTime?: number; // startTime is optional, defaults to 0 for full snippets
}> = createCommand('INSERT_AUDIO_BLOCK_COMMAND');

// The plugin no longer needs to know about global recording state directly
// for automatic insertion. It only handles the command.
export default function AudioBlockPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command listener for inserting audio blocks
    return editor.registerCommand(
      INSERT_AUDIO_BLOCK_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          
          if ($isRangeSelection(selection)) {
            const { audioFilePath, recordingId } = payload;
            const blockId = payload.blockId || `block-${uuidv4()}`; // Generate blockId if not provided
            const startTime = payload.startTime || 0; // Default startTime to 0 if not provided

            const audioBlockNode = $createAudioBlockNode(
              audioFilePath, // Use audioFilePath
              blockId,
              startTime,
              recordingId
            );
            
            selection.insertNodes([audioBlockNode]);
          }
        });
        
        return true; // Command was handled
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}

