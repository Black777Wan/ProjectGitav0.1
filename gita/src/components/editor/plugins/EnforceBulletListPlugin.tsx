import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getRoot, 
  $getSelection, 
  $isRangeSelection, 
  $createParagraphNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  KEY_BACKSPACE_COMMAND,
  $setSelection,
  $createRangeSelection
} from 'lexical';
import { $createListItemNode, $createListNode, $isListNode, $isListItemNode } from '@lexical/list';

export default function EnforceBulletListPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Initialize with bullet list when editor is empty
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        if (root.getChildrenSize() === 0) {
          editor.update(() => {
            const root = $getRoot();
            const listNode = $createListNode('bullet');
            const listItemNode = $createListItemNode();
            const paragraph = $createParagraphNode();
            
            listItemNode.append(paragraph);
            listNode.append(listItemNode);
            root.append(listNode);
            
            // Set cursor to the paragraph
            const selection = $createRangeSelection();
            selection.anchor.set(paragraph.getKey(), 0, 'element');
            selection.focus.set(paragraph.getKey(), 0, 'element');
            $setSelection(selection);
          });
        }
      });
    });
  }, [editor]);

  useEffect(() => {
    // Handle Enter key presses to ensure new content is always in bullet lists
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const anchorNode = selection.anchor.getNode();
        
        // If we're already in a list item, let default behavior handle it
        if ($isListItemNode(anchorNode) || $isListItemNode(anchorNode.getParent())) {
          return false;
        }

        // If we're in a regular paragraph, convert it to a list item
        editor.update(() => {
          const listNode = $createListNode('bullet');
          const listItemNode = $createListItemNode();
          const paragraph = $createParagraphNode();
          
          listItemNode.append(paragraph);
          listNode.append(listItemNode);
          
          // Replace current selection with new list
          selection.insertNodes([listNode]);
          
          // Focus on the new paragraph
          const newSelection = $createRangeSelection();
          newSelection.anchor.set(paragraph.getKey(), 0, 'element');
          newSelection.focus.set(paragraph.getKey(), 0, 'element');
          $setSelection(newSelection);
        });
        
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  useEffect(() => {
    // Prevent backspace from removing all content (protect title separation)
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const root = $getRoot();
        const firstChild = root.getFirstChild();
        
        // If we're at the very beginning of the first list item, prevent deletion
        if ($isListNode(firstChild)) {
          const firstListItem = firstChild.getFirstChild();
          if ($isListItemNode(firstListItem)) {
            const firstParagraph = firstListItem.getFirstChild();
            if (firstParagraph && 
                selection.anchor.offset === 0 && 
                selection.focus.offset === 0 &&
                selection.anchor.getNode() === firstParagraph) {
              return true; // Prevent deletion
            }
          }
        }
        
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}