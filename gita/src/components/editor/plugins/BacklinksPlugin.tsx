import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { $createBacklinkNode } from '../nodes/BacklinkNode';

// Define a custom command for inserting backlinks
export const INSERT_BACKLINK_COMMAND: LexicalCommand<{
  noteId: string;
  noteTitle: string;
}> = createCommand('INSERT_BACKLINK_COMMAND');

export default function BacklinksPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command listener for inserting backlinks
    return editor.registerCommand(
      INSERT_BACKLINK_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          
          if ($isRangeSelection(selection)) {
            const { noteId, noteTitle } = payload;
            const backlinkNode = $createBacklinkNode(noteId, noteTitle);
            
            selection.insertNodes([backlinkNode]);
          }
        });
        
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}

