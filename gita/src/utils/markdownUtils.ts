import { $getRoot, EditorState } from 'lexical';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS as LEXICAL_TRANSFORMERS,
  LIST_TRANSFORMER as OriginalListTransformer,
  ElementTransformer // For typing, might not be strictly necessary if not directly used for variable types
} from '@lexical/markdown';

// Define the custom list transformer
const customListTransformer: ElementTransformer = {
  ...OriginalListTransformer,
  export: (node, exportChildren, depth) => {
    // Cast node to access specific list properties like getListType()
    // This assumes 'node' is a ListNode-like structure.
    // Proper typing would involve ensuring 'node' conforms to an interface that has getListType.
    // For Lexical, ListNode has 'getListType()'.
    const listNode = node as any; // Using 'any' for simplicity, ensure correct type in practice.

    // Call the original transformer's export function to get the default markdown output.
    // This is generally safer than trying to rebuild the entire export logic.
    let markdownOutput = OriginalListTransformer.export(node, exportChildren, depth);

    // If the list is a bullet list, replace '*' with '-'
    if (listNode.getListType && listNode.getListType() === 'bullet') {
      // Replace leading '* ' with '- ' for each list item line.
      // This regex handles various indentation levels:
      // ^(\s*) matches any leading whitespace (indentation) and captures it (group 1).
      // \* matches the literal asterisk.
      // (\s) matches a single whitespace character after the asterisk and captures it (group 2).
      // gm flags ensure it works globally (all occurrences) and multiline.
      // $1-$2 replaces the matched pattern with the captured indentation, a hyphen, and the captured space.
      markdownOutput = markdownOutput.replace(/^(\s*)\*(\s)/gm, '$1-$2');
    }
    return markdownOutput;
  },
};

// Create a new transformers array, replacing the original list transformer with the custom one.
const customTransformers: ElementTransformer[] = LEXICAL_TRANSFORMERS.map(transformer => {
  if (transformer === OriginalListTransformer) {
    return customListTransformer;
  }
  return transformer;
});

// If OriginalListTransformer might not be in LEXICAL_TRANSFORMERS by default (e.g. if it's a complex setup)
// a more robust way to ensure it's replaced (or added if missing and LIST_TRANSFORMER was a category)
// would be to filter it out and then add the custom one.
// However, typically LIST_TRANSFORMER is a specific object in the array.

/**
 * Convert markdown text to Lexical editor state
 * 
 * @param markdown The markdown text to convert
 * @returns A function that initializes the editor state
 */
export function markdownToLexical(markdown: string): () => void {
  return () => {
    // This function is executed by Lexical within an update cycle.
    // $getRoot() and other $ prefixed functions are available.
    $getRoot().clear(); // Clear previous content
    $convertFromMarkdownString(markdown, customTransformers);
  };
}

/**
 * Convert Lexical editor state to markdown text
 * 
 * @param editorState The Lexical editor state
 * @returns The markdown text
 */
export function lexicalToMarkdown(editorState: EditorState): string {
  return editorState.read(() => $convertToMarkdownString(customTransformers));
}

