import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { $createBlockReferenceNode } from '../nodes/BlockReferenceNode';

// Define a custom command for inserting block references
export const INSERT_BLOCK_REFERENCE_COMMAND: LexicalCommand<{
  blockId: string;
  noteId: string;
  previewText: string;
}> = createCommand('INSERT_BLOCK_REFERENCE_COMMAND');

export default function BlockReferencePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command listener for inserting block references
    return editor.registerCommand(
      INSERT_BLOCK_REFERENCE_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          
          if ($isRangeSelection(selection)) {
            const { blockId, noteId, previewText } = payload;
            const blockReferenceNode = $createBlockReferenceNode(blockId, noteId, previewText);
            
            selection.insertNodes([blockReferenceNode]);
          }
        });
        
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}

