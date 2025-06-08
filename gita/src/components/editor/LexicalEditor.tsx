import React, { useMemo, useEffect, useRef } from 'react'; // Added useMemo
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list'; // CheckListNode was in both
// import { CheckListNode } from '@lexical/list'; // CheckListNode was in both - Commented out due to TS2305
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { AutoLinkNode, LinkNode } from '@lexical/link';

import { BlockReferenceNode } from './nodes/BlockReferenceNode';
import { AudioBlockNode } from './nodes/AudioBlockNode'; // Keep this from jules_wip

import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { EditorState } from 'lexical'; // Removed LexicalEditorType
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import EditorToolbar from './EditorToolbar';
import AutoTimestampPlugin from './plugins/AutoTimestampPlugin';
import EnforceBulletListPlugin from './plugins/EnforceBulletListPlugin';
import TabIndentationPlugin from './plugins/TabIndentationPlugin';
import './LexicalEditor.css';

interface LexicalEditorProps {
  initialContent?: string; // Should be JSON string
  onChange?: (content: string) => void; // Should be JSON string
  currentNoteId: string;
  onDeleteNote?: () => void;
}

// Helper component to initialize editor state from JSON
const InitializeStatePlugin: React.FC<{ initialContent?: string; noteId: string }> = ({ initialContent, noteId }) => {
  const [editor] = useLexicalComposerContext();
  const hasInitializedThisInstance = useRef(false); // Flag for the current instance

  useEffect(() => {
    // If this instance hasn't initialized yet, and we have valid content and an editor
    if (!hasInitializedThisInstance.current && editor && initialContent && initialContent.trim() !== '') {
      try {
        // console.log(`InitializeStatePlugin: Setting state for noteId: ${noteId} (Instance first time)`);
        const parsedState = editor.parseEditorState(initialContent);
        editor.setEditorState(parsedState);
        hasInitializedThisInstance.current = true; // Mark this instance as initialized
      } catch (e) {
        console.error(`InitializeStatePlugin: Error setting state for noteId ${noteId}:`, e);
        // Optionally, set to a default empty state or handle error if parsing fails
        // editor.setEditorState(editor.parseEditorState(JSON.stringify({root:{children:[{type:'paragraph',version:1}],direction:null,format:'',indent:0,version:1}})));
        // hasInitializedThisInstance.current = true; // Still mark as initialized to prevent loops
      }
    }
  }, [editor, initialContent, noteId]); // noteId is stable for this instance due to parent keying

  return null;
};

const LexicalEditorComponent: React.FC<LexicalEditorProps> = ({ // Renamed to avoid conflict if not already
  initialContent,
  onChange,
  currentNoteId,
  onDeleteNote
}) => {
  // Memoize theme as it's static
  const theme = useMemo(() => ({
    ltr: 'ltr',
    rtl: 'rtl',
    paragraph: 'editor-paragraph',
    quote: 'editor-quote',
    heading: {
      h1: 'editor-heading-h1',
      h2: 'editor-heading-h2',
      h3: 'editor-heading-h3',
      h4: 'editor-heading-h4',
      h5: 'editor-heading-h5',
      h6: 'editor-heading-h6',
    },
    list: {
      nested: {
        listitem: 'editor-nested-listitem',
      },
      ol: 'editor-list-ol',
      ul: 'editor-list-ul',
      listitem: 'editor-listitem',
      listitemChecked: 'editor-listitem-checked',
      listitemUnchecked: 'editor-listitem-unchecked',
    },
    image: 'editor-image',
    link: 'editor-link',
    text: {
      bold: 'editor-text-bold',
      italic: 'editor-text-italic',
      underline: 'editor-text-underline',
      strikethrough: 'editor-text-strikethrough',
      underlineStrikethrough: 'editor-text-underlineStrikethrough',
      code: 'editor-text-code',
    },
    code: 'editor-code',
    codeHighlight: {
      atrule: 'editor-tokenAttr',
      attr: 'editor-tokenAttr',
      boolean: 'editor-tokenProperty',
      builtin: 'editor-tokenSelector',
      cdata: 'editor-tokenComment',
      char: 'editor-tokenSelector',
      class: 'editor-tokenFunction',
      'class-name': 'editor-tokenFunction',
      comment: 'editor-tokenComment',
      constant: 'editor-tokenProperty',
      deleted: 'editor-tokenProperty',
      doctype: 'editor-tokenComment',
      entity: 'editor-tokenOperator',
      function: 'editor-tokenFunction',
      important: 'editor-tokenVariable',
      inserted: 'editor-tokenSelector',
      keyword: 'editor-tokenAttr',
      namespace: 'editor-tokenVariable',
      number: 'editor-tokenProperty',
      operator: 'editor-tokenOperator',
      prolog: 'editor-tokenComment',
      property: 'editor-tokenProperty',
      punctuation: 'editor-tokenPunctuation',
      regex: 'editor-tokenVariable',
      selector: 'editor-tokenSelector',
      string: 'editor-tokenSelector',
      symbol: 'editor-tokenProperty',
      tag: 'editor-tokenProperty',
      url: 'editor-tokenOperator',
      variable: 'editor-tokenVariable',
    },
    audioBlock: 'editor-audio-block',
  }), []);

  // Memoize editorConfig. It depends on `theme`.
  const editorConfig = useMemo(() => ({
    namespace: 'obsidian-replica-editor',
    theme,
    onError: (error: Error) => {
      console.error('Editor error:', error);
    },
    ErrorBoundary: LexicalErrorBoundary,
    nodes: [
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
      BlockReferenceNode,
      AudioBlockNode,
    ],
  }), [theme]);

  const handleEditorChange = (editorState: EditorState) => {
    if (onChange) {
      const jsonString = JSON.stringify(editorState.toJSON());
      onChange(jsonString);
    }
  };
  return (
    <div className="lexical-editor-container bg-light-bg dark:bg-obsidian-bg text-light-text dark:text-obsidian-text">
      <LexicalComposer initialConfig={editorConfig}>
        <div className="editor-inner">
          <EditorToolbar currentNoteId={currentNoteId} onDeleteNote={onDeleteNote} />
          <div className="editor-content">
            <RichTextPlugin
              contentEditable={<ContentEditable className="editor-input" />}
              placeholder={<div className="editor-placeholder">start typing</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <ListPlugin />
            <LinkPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <OnChangePlugin onChange={handleEditorChange} />
            <InitializeStatePlugin initialContent={initialContent} noteId={currentNoteId} />
            <AutoTimestampPlugin />
            <EnforceBulletListPlugin />
            <TabIndentationPlugin />
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
};

export default LexicalEditorComponent; // Ensure this is the name exported if renamed
