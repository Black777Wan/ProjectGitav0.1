import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND
} from 'lexical';
import { $isListItemNode, $isListNode } from '@lexical/list';

export default function TabIndentationPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Handle Tab key for indentation
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (payload) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const anchorNode = selection.anchor.getNode();
        
        // Check if we're in a list item or its parent is a list item
        const listItem = $isListItemNode(anchorNode) 
          ? anchorNode 
          : $isListItemNode(anchorNode.getParent()) 
            ? anchorNode.getParent() 
            : null;
        
        if (listItem) {
          if (payload.shiftKey) {
            // Shift+Tab to outdent
            editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
          } else {
            // Tab to indent
            editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
          }
          return true;
        }
        
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}