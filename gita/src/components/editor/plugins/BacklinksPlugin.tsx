import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { $createBacklinkNode, BacklinkNode } from '../nodes/BacklinkNode'; // Imported BacklinkNode for instanceof check
import { TextNode, ElementNode } from 'lexical'; // Imported TextNode and ElementNode

// Define a custom command for inserting backlinks
export const INSERT_BACKLINK_COMMAND: LexicalCommand<{
  noteId: string;
  noteTitle: string;
}> = createCommand('INSERT_BACKLINK_COMMAND');

export default function BacklinksPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command listener for inserting backlinks (used by typeahead selection)
    const unregisterCommand = editor.registerCommand(
      INSERT_BACKLINK_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            // If the command is dispatched, it means a selection was made from typeahead.
            // The typeahead logic (node transform) should ideally remove the trigger text "[[search]]"
            // before this command inserts the node.
            // However, if the selection is on the trigger text, insertNodes might replace it.
            const { noteId, noteTitle } = payload;
            const backlinkNode = $createBacklinkNode(noteId, noteTitle);
            selection.insertNodes([backlinkNode]);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    // Register a transform for TextNode to detect "[[search term]]"
    const unregisterNodeTransform = editor.registerNodeTransform(TextNode, (textNode: TextNode) => {
      const text = textNode.getTextContent();
      // Regex to find "[[search term]]"
      // This regex finds the *last* occurrence if multiple are in the same TextNode.
      // A more sophisticated approach might handle multiple or use Lexical's tokenizer.
      const match = text.match(/\[\[([^\]]+)\]\]$/);

      if (match && match[1]) {
        const searchTerm = match[1];
        const query = searchTerm; // The text between [[ and ]]

        // For this subtask, we simulate resolution and replace directly.
        // A real typeahead would pop up a menu here.
        // If the user types, e.g., "[[Mock Note 1]]" and it's a "complete" entry.

        // Simulate selecting "Mock Note 1" which resolves to noteId: "note1"
        // This is a simplified direct replacement. A real typeahead would use INSERT_BACKLINK_COMMAND.
        if (query === "Mock Note 1") {
          console.log("Typeahead pattern matched and resolved (mocked):", query);

          // Direct replacement logic (simplified for this subtask)
          // This assumes the [[query]] is at the end of the text node.
          const parent = textNode.getParent();
          if (parent) {
            const backlinkNode = $createBacklinkNode("note1", "Mock Note 1");

            if (textNode.getTextContent() === `[[${query}]]`) {
              // If the entire text node is the trigger, replace it
              textNode.replace(backlinkNode);
            } else {
              // If it's at the end of a larger text node, split and replace
              const endOffset = textNode.getTextContent().length;
              const startOffset = endOffset - query.length - 4; // length of "[[query]]"

              if (startOffset >= 0) {
                const newTextNode = textNode.splitText(startOffset)[1]; // textNode now contains text before "[["
                if (newTextNode && newTextNode.getTextContent() === `[[${query}]]`) {
                   newTextNode.replace(backlinkNode);
                } else {
                    // If splitText didn't isolate it perfectly, might need more robust logic
                    // or ensure the regex/trigger condition is more specific.
                    // For this demo, this path might not be hit if regex is `...]]$`
                    console.warn("Could not precisely isolate [[query]] for replacement after split.");
                }
              }
            }
          }
        }
        // In a real typeahead, you would not do direct replacement here.
        // You'd open a menu. The menu selection would then call INSERT_BACKLINK_COMMAND.
        // The command handler would then replace the text that triggered the typeahead.
      }
    });

    return () => {
      unregisterCommand();
      unregisterNodeTransform();
    };
  }, [editor]);

  return null;
}

