import { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode } from '@lexical/react/LexicalDecoratorNode';
import React from 'react';

export interface BlockReferencePayload {
  blockId: string;
  noteId: string;
  previewText: string;
}

export type SerializedBlockReferenceNode = Spread<
  {
    blockId: string;
    noteId: string;
    previewText: string;
    type: 'block-reference';
    version: 1;
  },
  SerializedLexicalNode
>;

export class BlockReferenceNode extends DecoratorNode<React.ReactNode> {
  __blockId: string;
  __noteId: string;
  __previewText: string;

  static getType(): string {
    return 'block-reference';
  }

  static clone(node: BlockReferenceNode): BlockReferenceNode {
    return new BlockReferenceNode(
      node.__blockId,
      node.__noteId,
      node.__previewText,
      node.__key
    );
  }

  constructor(
    blockId: string,
    noteId: string,
    previewText: string,
    key?: NodeKey
  ) {
    super(key);
    this.__blockId = blockId;
    this.__noteId = noteId;
    this.__previewText = previewText;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.className = 'editor-block-reference';
    return span;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedBlockReferenceNode): BlockReferenceNode {
    const { blockId, noteId, previewText } = serializedNode;
    const node = new BlockReferenceNode(blockId, noteId, previewText);
    return node;
  }

  exportJSON(): SerializedBlockReferenceNode {
    return {
      blockId: this.__blockId,
      noteId: this.__noteId,
      previewText: this.__previewText,
      type: 'block-reference',
      version: 1,
    };
  }

  decorate(): React.ReactNode {
    return (
      <span className="editor-block-reference" title={`Reference to block in ${this.__noteId}`}>
        {this.__previewText || `Block reference: ${this.__blockId}`}
      </span>
    );
  }
}

export function $createBlockReferenceNode(
  blockId: string,
  noteId: string,
  previewText: string
): BlockReferenceNode {
  return new BlockReferenceNode(blockId, noteId, previewText);
}

export function $isBlockReferenceNode(
  node: LexicalNode | null | undefined
): node is BlockReferenceNode {
  return node instanceof BlockReferenceNode;
}

