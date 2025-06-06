import { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode } from '@lexical/react/LexicalDecoratorNode';
import React from 'react';
import AudioBlockComponent from '../AudioBlockComponent';

export interface AudioBlockPayload {
  audioFilePath: string;
  recordingId: string;
  startTime: number;
  // blockId will be the node's own key
}

export type SerializedAudioBlockNode = Spread<
  {
    audioFilePath: string;
    recordingId: string;
    startTime: number;
    blockId: NodeKey; // blockId is the NodeKey
    type: 'audio-block';
    version: 1;
  },
  SerializedLexicalNode
>;

export class AudioBlockNode extends DecoratorNode<React.ReactNode> {
  __audioFilePath: string;
  __recordingId: string;
  __startTime: number;
  // __blockId will be this.getKey() implicitly, or store this.__key if needed for decoration access
  // Let's explicitly store it for clarity in decorate and exportJSON if needed, though getKey() is canonical.
  __blockId: NodeKey;


  static getType(): string {
    return 'audio-block';
  }

  static clone(node: AudioBlockNode): AudioBlockNode {
    // Pass node.__key to ensure cloned node gets the same key if that's desired,
    // or let Lexical assign a new key if node.__key is not passed.
    // For true clone, pass the key.
    return new AudioBlockNode(
      node.__audioFilePath,
      node.__recordingId,
      node.__startTime,
      node.__key // Pass the original key for a true clone
    );
  }

  constructor(
    audioFilePath: string,
    recordingId: string,
    startTime: number,
    key?: NodeKey
  ) {
    super(key);
    this.__audioFilePath = audioFilePath;
    this.__recordingId = recordingId;
    this.__startTime = startTime;
    this.__blockId = this.getKey(); // Store the node's own key as its blockId
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'editor-audio-block';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  // Method to get the internal blockId (which is its Lexical key)
  getBlockId(): NodeKey {
    return this.__blockId;
  }

  static importJSON(serializedNode: SerializedAudioBlockNode): AudioBlockNode {
    // blockId from JSON is used as the key for the new node
    const node = new AudioBlockNode(
      serializedNode.audioFilePath,
      serializedNode.recordingId,
      serializedNode.startTime,
      serializedNode.blockId // Use blockId from JSON as the key
    );
    // Ensure __blockId is correctly set after construction if key is overridden
    // In this constructor, this.__blockId = this.getKey() handles it.
    return node;
  }

  exportJSON(): SerializedAudioBlockNode {
    return {
      audioFilePath: this.__audioFilePath,
      recordingId: this.__recordingId,
      startTime: this.__startTime,
      blockId: this.getKey(), // Use the node's actual key for serialization
      type: 'audio-block',
      version: 1,
    };
  }

  decorate(): React.ReactNode {
    return (
      <AudioBlockComponent 
        audioFilePath={this.__audioFilePath}
        blockId={this.getKey()} // Pass the node's key as blockId to component
        startTime={this.__startTime}
        recordingId={this.__recordingId}
      />
    );
  }
}

export function $createAudioBlockNode(
  audioFilePath: string,
  recordingId: string,
  startTime: number
): AudioBlockNode {
  // blockId is not passed; it will be the node's own key.
  return new AudioBlockNode(audioFilePath, recordingId, startTime);
}

export function $isAudioBlockNode(
  node: LexicalNode | null | undefined
): node is AudioBlockNode {
  return node instanceof AudioBlockNode;
}

