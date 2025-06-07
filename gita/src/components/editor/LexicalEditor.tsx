import React from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
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
import { EditorState } from 'lexical';

import { markdownToLexical, lexicalToMarkdown } from '../../utils/markdownUtils';
import EditorToolbar from './EditorToolbar';
import AutoTimestampPlugin from './plugins/AutoTimestampPlugin';
import './LexicalEditor.css';

interface LexicalEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  currentNoteId: string; 
}

const LexicalEditor: React.FC<LexicalEditorProps> = ({
  initialContent = '',
  onChange,
  currentNoteId
}) => {
  const theme = {
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
      listitemChecked: 'editor-listitem-checked', // Added for checklist
      listitemUnchecked: 'editor-listitem-unchecked', // Added for checklist
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
    // For AudioBlockNode custom styling if needed
    audioBlock: 'editor-audio-block', 
  };

  const editorConfig = {
    editorState: initialContent ? markdownToLexical(initialContent) : undefined,
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
      // CheckListNode, // Commented out due to TS2305
      BlockReferenceNode,
      AudioBlockNode, // Keep this from jules_wip
    ],
  };

  const handleEditorChange = (editorState: EditorState) => {
    if (onChange) {
      const markdown = lexicalToMarkdown(editorState);
      onChange(markdown);
    }
  };

  return (
    <div className="lexical-editor-container bg-light-bg dark:bg-obsidian-bg text-light-text dark:text-obsidian-text">
      <LexicalComposer initialConfig={editorConfig}>
        <div className="editor-inner">
          <EditorToolbar currentNoteId={currentNoteId} />
          <div className="editor-content">
            <RichTextPlugin
              contentEditable={<ContentEditable className="editor-input" />}
              placeholder={<div className="editor-placeholder">Start writing...</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <ListPlugin />
            <LinkPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <OnChangePlugin onChange={handleEditorChange} />
            <AutoTimestampPlugin /> 
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
};

export default LexicalEditor;
