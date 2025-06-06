import { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode } from '@lexical/react/LexicalDecoratorNode';
import React from 'react';
import AudioBlockComponent from '../AudioBlockComponent';

export interface AudioBlockPayload {
  audioFilePath: string; // Changed from audioSrc
  blockId: string;
  startTime: number; // startTime will be 0 for manually inserted full snippets
  recordingId: string;
}

export type SerializedAudioBlockNode = Spread<
  {
    audioFilePath: string; // Changed from audioSrc
    blockId: string;
    startTime: number;
    recordingId: string;
    type: 'audio-block';
    version: 1;
  },
  SerializedLexicalNode
>;

export class AudioBlockNode extends DecoratorNode<React.ReactNode> {
  __audioFilePath: string; // Changed from __audioSrc
  __blockId: string;
  __startTime: number;
  __recordingId: string;

  static getType(): string {
    return 'audio-block';
  }

  static clone(node: AudioBlockNode): AudioBlockNode {
    return new AudioBlockNode(
      node.__audioFilePath, // Changed from node.__audioSrc
      node.__blockId,
      node.__startTime,
      node.__recordingId,
      node.__key
    );
  }

  constructor(
    audioFilePath: string, // Changed from audioSrc
    blockId: string,
    startTime: number,
    recordingId: string,
    key?: NodeKey
  ) {
    super(key);
    this.__audioFilePath = audioFilePath; // Changed from __audioSrc = audioSrc
    this.__blockId = blockId;
    this.__startTime = startTime;
    this.__recordingId = recordingId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'editor-audio-block';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedAudioBlockNode): AudioBlockNode {
    const { audioFilePath, blockId, startTime, recordingId } = serializedNode; // Changed audioSrc
    const node = new AudioBlockNode(audioFilePath, blockId, startTime, recordingId); // Changed audioSrc
    return node;
  }

  exportJSON(): SerializedAudioBlockNode {
    return {
      audioFilePath: this.__audioFilePath, // Changed from audioSrc: this.__audioSrc
      blockId: this.__blockId,
      startTime: this.__startTime,
      recordingId: this.__recordingId,
      type: 'audio-block',
      version: 1,
    };
  }

  decorate(): React.ReactNode {
    return (
      <AudioBlockComponent 
        audioFilePath={this.__audioFilePath} // Changed from audioSrc
        blockId={this.__blockId}
        startTime={this.__startTime} // This will be 0 for manually inserted full audio files
        recordingId={this.__recordingId}
      />
    );
  }
}

export function $createAudioBlockNode(
  audioFilePath: string, // Changed from audioSrc
  blockId: string,
  startTime: number, // Should typically be 0 for new manual insertions
  recordingId: string
): AudioBlockNode {
  return new AudioBlockNode(audioFilePath, blockId, startTime, recordingId); // Changed audioSrc
}

export function $isAudioBlockNode(
  node: LexicalNode | null | undefined
): node is AudioBlockNode {
  return node instanceof AudioBlockNode;
}

