import { $getRoot, EditorState } from 'lexical';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS as LEXICAL_TRANSFORMERS,
  // ElementTransformer is useful for typing if we declare variable types,
  // but customListTransformer will infer its type from OriginalListTransformer.
  ElementTransformer
} from '@lexical/markdown';

// Find the original ListTransformer from Lexical's exported array.
// This heuristic checks for a common regex used by list transformers.
const OriginalListTransformer = LEXICAL_TRANSFORMERS.find(transformer => {
  if (transformer && typeof transformer === 'object' && transformer.regExp) {
    // Common regex for markdown lists (unordered or ordered)
    const listRegexSrc = /^(?:(?:\s*(?:\*|\-|\+))|\s*\d+\.\s+)/.source;
    // Check if the transformer's regex source string starts with the list regex pattern
    // This is more robust than direct equality if Lexical's regex has flags or additions.
    return typeof transformer.regExp.source === 'string' && transformer.regExp.source.startsWith(listRegexSrc.substring(0, listRegexSrc.length -1)); // removing trailing / from source
  }
  return false;
});

if (!OriginalListTransformer) {
  // Fallback or more detailed error reporting if needed.
  // For now, this will stop execution if the transformer isn't found, which is critical.
  console.error("Failed to find the original ListTransformer in LEXICAL_TRANSFORMERS. Markdown list conversion may not work as expected.");
  // Depending on strictness, could throw new Error(...)
}

// Define the custom list transformer, only if OriginalListTransformer was found.
// The customListTransformer type will be inferred from OriginalListTransformer.
const customListTransformer = OriginalListTransformer ? {
  ...OriginalListTransformer, // Spread existing properties
  export: (node: any, exportChildren: (node: any) => string, depth: number) => {
    // Cast node to access specific list properties like getListType()
    const listNode = node; // Assuming node is already the correct type or 'any' allows getListType

    // Call the original transformer's export function.
    // The '!' asserts that 'export' is present on OriginalListTransformer.
    // This is needed if the 'export' method is optional in the base ElementTransformer type.
    let markdownOutput = OriginalListTransformer.export!(node, exportChildren, depth);

    if (listNode.getListType && listNode.getListType() === 'bullet') {
      markdownOutput = markdownOutput.replace(/^(\s*)\*(\s)/gm, '$1-$2');
    }
    return markdownOutput;
  },
} : null; // Handle case where OriginalListTransformer might not be found

// Create the final transformers array for use in the editor.
// If customListTransformer is null (original not found), then just use LEXICAL_TRANSFORMERS.
const finalTransformers: ElementTransformer[] = customListTransformer
  ? LEXICAL_TRANSFORMERS.map(transformer =>
      transformer === OriginalListTransformer ? customListTransformer : transformer
    )
  : LEXICAL_TRANSFORMERS;

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
    $convertFromMarkdownString(markdown, finalTransformers);
  };
}

/**
 * Convert Lexical editor state to markdown text
 * 
 * @param editorState The Lexical editor state
 * @returns The markdown text
 */
export function lexicalToMarkdown(editorState: EditorState): string {
  return editorState.read(() => $convertToMarkdownString(finalTransformers));
}

