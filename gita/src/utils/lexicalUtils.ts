import { createEditor, EditorState } from 'lexical';
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';

// Standard Lexical Nodes
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { AutoLinkNode, LinkNode } from '@lexical/link';

// Custom Nodes used in the editor (ensure these are correctly imported and defined)
// For the purpose of this util, if they don't have direct markdown representations
// or if their definitions are complex and not needed for basic markdown conversion,
// they might be omitted from the headless editor's node list if they cause issues.
// However, for accurate parsing of the JSON, they *should* be included if the JSON
// contains them. If they lack transformers, $convertToMarkdownString might ignore them or error.
import { BlockReferenceNode } from '../components/editor/nodes/BlockReferenceNode';
import { AudioBlockNode } from '../components/editor/nodes/AudioBlockNode';

// This list MUST match the nodes used in the main LexicalEditor.tsx instance
// to correctly parse the editor state JSON.
const editorNodes = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  AutoLinkNode,
  LinkNode,
  // CheckListNode, // Was commented out in LexicalEditor.tsx
  BlockReferenceNode, // Custom node
  AudioBlockNode,     // Custom node
];

const editorConfig = {
  namespace: 'markdown-converter',
  nodes: editorNodes,
  onError: (error: Error) => {
    console.error('Markdown conversion headless editor error:', error);
    // Depending on requirements, you might want to throw the error
    // or return a specific indicator of failure.
    // For now, we log and let $convertToMarkdownString handle it or error out from there.
  },
};

export function convertLexicalJSONToMarkdown(lexicalJSON: string): string {
  if (!lexicalJSON || lexicalJSON.trim() === '{}' || lexicalJSON.trim() === '') {
    return ''; // Handle empty or placeholder JSON
  }

  const editor = createEditor(editorConfig);

  try {
    const editorState: EditorState = editor.parseEditorState(lexicalJSON);

    // $convertToMarkdownString needs to be called within an editor.getEditorState().read() block
    return editor.getEditorState().read(() => $convertToMarkdownString(TRANSFORMERS));
  } catch (e) {
    console.error("Error converting Lexical JSON to Markdown:", e);
    console.error("Problematic Lexical JSON string:", lexicalJSON); // Log the problematic JSON
    return ''; // Return empty string or some error placeholder
    // Consider re-throwing if the caller should handle this: throw e;
  }
}
