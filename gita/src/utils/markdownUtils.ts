import { $getRoot, EditorState } from 'lexical';
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';

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
    $convertFromMarkdownString(markdown, TRANSFORMERS);
  };
}

/**
 * Convert Lexical editor state to markdown text
 * 
 * @param editorState The Lexical editor state
 * @returns The markdown text
 */
export function lexicalToMarkdown(editorState: EditorState): string {
  return editorState.read(() => $convertToMarkdownString(TRANSFORMERS));
}

