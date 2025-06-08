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
  $createRangeSelection,
  RootNode // Import RootNode
} from 'lexical';
import { $createListItemNode, $createListNode, $isListNode, $isListItemNode, ListNode } from '@lexical/list'; // Import ListNode for type checking

export default function EnforceBulletListPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Initialize with bullet list when editor is empty
    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        if (root.getChildrenSize() === 0) {
          editor.update(() => {
            const listNode = $createListNode('bullet');
            const listItemNode = $createListItemNode();
            // Paragraphs inside list items are standard for Lexical lists
            const paragraph = $createParagraphNode();
            listItemNode.append(paragraph);
            listNode.append(listItemNode);
            root.append(listNode);
            // Select the beginning of the paragraph for immediate typing
            paragraph.selectStart();
          });
        }
      });
    });

    // Transform RootNode's children to ensure they are ListNodes
    const removeNodeTransform = editor.registerNodeTransform(RootNode, (rootNode: RootNode) => {
      const children = rootNode.getChildren();
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!$isListNode(child)) {
          // If a child is not a ListNode, wrap it.
          // This needs to happen in an editor.update block if not already in one.
          // Node transforms run within an update cycle.

          const newListItem = $createListItemNode();
          // If 'child' is already a ParagraphNode, it can be appended directly.
          // If 'child' is an inline node (e.g. TextNode directly under Root - unusual),
          // it should be wrapped in a ParagraphNode first.
          // However, ListItemNode typically expects block-level children.
          // For robustness, ensure 'child' becomes a valid child of ListItemNode.
          // If 'child' is a ParagraphNode or similar, it's fine.
          // If 'child' is something else (e.g. a custom non-block node), this might need adjustment.
          // Given typical Lexical content, non-ListNodes at root are often Paragraphs.

          if (child.isAttached()) { // Ensure node is attached before trying to operate
             // If child is a TextNode or other inline, wrap it in a paragraph first
            if (!$isListItemNode(child) && !$isListNode(child) && child.isInline()) {
                const paragraph = $createParagraphNode();
                paragraph.append(child.clone()); // Clone to be safe
                newListItem.append(paragraph);
            } else {
                 // It's likely a block node like ParagraphNode, or a node that ListItemNode can accept
                newListItem.append(child.clone()); // Clone the original child to append
            }

            const newList = $createListNode('bullet');
            newList.append(newListItem);
            child.replace(newList);

            // Since a change was made, Lexical will re-run transforms.
            // It's often good practice to not continue iterating on the same `children`
            // array after a mutation that changes its length or order.
            // Returning here means this transform pass is done.
            // Lexical will call it again if needed.
            return; // Exit after first modification to allow re-evaluation
          }
        }
      }
    });

    return () => {
      removeUpdateListener();
      removeNodeTransform();
    };
  }, [editor]);

  useEffect(() => {
    // Handle Enter key presses
    // With RootNode transform, selection should always be within a list item.
    // So, default behavior is usually what we want.
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const anchorNode = selection.anchor.getNode();
        const parentNode = anchorNode.getParent();

        // If inside a ListItemNode or its direct child (e.g., ParagraphNode),
        // let Lexical's default list behavior handle Enter.
        if ($isListItemNode(anchorNode) || $isListItemNode(parentNode)) {
          return false; // false means command not handled, allowing default behavior
        }

        // This case should ideally not be reached if RootNode transform works correctly,
        // as all content should be within ListItems.
        // However, as a fallback or for edge cases:
        editor.update(() => {
          const listItemNode = $createListItemNode();
          const paragraphNode = $createParagraphNode();
          listItemNode.append(paragraphNode);
          
          const listNode = $createListNode('bullet');
          listNode.append(listItemNode);

          // Attempt to insert the new list structure at the selection
          // This might replace a non-list node if one somehow exists at root.
          selection.insertNodes([listNode]);
          paragraphNode.selectStart(); // Select start of the new paragraph
        });
        // Ensure editor retains focus after handling the command
        setTimeout(() => editor.focus(), 0);
        return true; // true means command was handled
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
              // Prevent deletion and ensure editor retains focus
              setTimeout(() => editor.focus(), 0);
              return true;
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