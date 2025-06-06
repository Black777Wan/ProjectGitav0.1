import { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode } from '@lexical/react/LexicalDecoratorNode';
import React from 'react';

export interface BacklinkPayload {
  noteId: string;
  noteTitle: string;
}

export type SerializedBacklinkNode = Spread<
  {
    noteId: string;
    noteTitle: string;
    type: 'backlink';
    version: 1;
  },
  SerializedLexicalNode
>;

export class BacklinkNode extends DecoratorNode<React.ReactNode> {
  __noteId: string;
  __noteTitle: string;

  static getType(): string {
    return 'backlink';
  }

  static clone(node: BacklinkNode): BacklinkNode {
    return new BacklinkNode(
      node.__noteId,
      node.__noteTitle,
      node.__key
    );
  }

  constructor(
    noteId: string,
    noteTitle: string,
    key?: NodeKey
  ) {
    super(key);
    this.__noteId = noteId;
    this.__noteTitle = noteTitle;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.className = 'editor-backlink';
    return span;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedBacklinkNode): BacklinkNode {
    const { noteId, noteTitle } = serializedNode;
    const node = new BacklinkNode(noteId, noteTitle);
    return node;
  }

  exportJSON(): SerializedBacklinkNode {
    return {
      noteId: this.__noteId,
      noteTitle: this.__noteTitle,
      type: 'backlink',
      version: 1,
    };
  }

  decorate(): React.ReactNode {
    return (
      <span className="editor-backlink" title={`Link to ${this.__noteTitle}`}>
        [[{this.__noteTitle}]]
      </span>
    );
  }
}

export function $createBacklinkNode(
  noteId: string,
  noteTitle: string
): BacklinkNode {
  return new BacklinkNode(noteId, noteTitle);
}

export function $isBacklinkNode(
  node: LexicalNode | null | undefined
): node is BacklinkNode {
  return node instanceof BacklinkNode;
}

