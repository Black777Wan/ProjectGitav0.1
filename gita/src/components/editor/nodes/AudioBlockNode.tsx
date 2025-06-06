import { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode } from '@lexical/react/LexicalDecoratorNode';
import React from 'react';
import AudioBlockComponent from '../AudioBlockComponent';

export interface AudioBlockPayload {
  audioSrc: string;
  blockId: string;
  startTime: number;
  recordingId: string;
}

export type SerializedAudioBlockNode = Spread<
  {
    audioSrc: string;
    blockId: string;
    startTime: number;
    recordingId: string;
    type: 'audio-block';
    version: 1;
  },
  SerializedLexicalNode
>;

export class AudioBlockNode extends DecoratorNode<React.ReactNode> {
  __audioSrc: string;
  __blockId: string;
  __startTime: number;
  __recordingId: string;

  static getType(): string {
    return 'audio-block';
  }

  static clone(node: AudioBlockNode): AudioBlockNode {
    return new AudioBlockNode(
      node.__audioSrc,
      node.__blockId,
      node.__startTime,
      node.__recordingId,
      node.__key
    );
  }

  constructor(
    audioSrc: string,
    blockId: string,
    startTime: number,
    recordingId: string,
    key?: NodeKey
  ) {
    super(key);
    this.__audioSrc = audioSrc;
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
    const { audioSrc, blockId, startTime, recordingId } = serializedNode;
    const node = new AudioBlockNode(audioSrc, blockId, startTime, recordingId);
    return node;
  }

  exportJSON(): SerializedAudioBlockNode {
    return {
      audioSrc: this.__audioSrc,
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
        audioSrc={this.__audioSrc} 
        blockId={this.__blockId}
        startTime={this.__startTime}
        recordingId={this.__recordingId}
      />
    );
  }
}

export function $createAudioBlockNode(
  audioSrc: string,
  blockId: string,
  startTime: number,
  recordingId: string
): AudioBlockNode {
  return new AudioBlockNode(audioSrc, blockId, startTime, recordingId);
}

export function $isAudioBlockNode(
  node: LexicalNode | null | undefined
): node is AudioBlockNode {
  return node instanceof AudioBlockNode;
}

