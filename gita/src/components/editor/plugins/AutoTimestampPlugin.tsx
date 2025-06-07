import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $isParagraphNode,
  $isHeadingNode,
  $isListItemNode,
  NodeKey,
  NodeMutation,
  LexicalEditor,
  $createParagraphNode, // From jules_wip
  $isRootNode,          // From jules_wip
  // ElementNode,       // ElementNode from jules_wip not strictly needed if using specific types
} from 'lexical';
import { useAudioRecordingStore } from '../../../stores/audioRecordingStore';
import { invoke } from '@tauri-apps/api/tauri';
import { $createAudioBlockNode } from '../nodes/AudioBlockNode'; // From jules_wip

// Helper function to check if a node is a "taggable" block type that should be replaced by an AudioBlockNode
// (from jules_wip)
const isReplaceableEmptyBlock = (node: any): boolean => {
  if (!node) return false;
  // Only target empty Paragraphs, Headings, or ListItems for replacement
  if (($isParagraphNode(node) || $isHeadingNode(node) || $isListItemNode(node)) && node.getChildrenSize() === 0) {
    // Further check: ensure it's a direct child of root or a list,
    // to avoid replacing nodes nested deeply in other structures unexpectedly.
    const parent = node.getParent();
    return parent && ($isRootNode(parent) || parent.getType() === 'list');
  }
  return false;
};


export default function AutoTimestampPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const {
    isRecordingActive,
    currentRecordingId,
    currentRecordingOffsetMs,
    currentRecordingFilePath // Get the file path (from jules_wip)
  } = useAudioRecordingStore(
    (state) => ({
      isRecordingActive: state.isRecordingActive,
      currentRecordingId: state.currentRecordingId,
      currentRecordingOffsetMs: state.currentRecordingOffsetMs,
      currentRecordingFilePath: state.currentRecordingFilePath, // From jules_wip
    })
  );

  const [processedNodesForCurrentRecording, setProcessedNodesForCurrentRecording] = useState<Set<NodeKey>>(new Set());
  const lastProcessedRecordingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor) return;

    if (currentRecordingId !== lastProcessedRecordingIdRef.current) {
      setProcessedNodesForCurrentRecording(new Set());
      lastProcessedRecordingIdRef.current = currentRecordingId;
    }

    // Logic from jules_wip
    if (!isRecordingActive || !currentRecordingId || !currentRecordingFilePath) {
      return;
    }

    const unregisterMutationListener = editor.registerMutationListener(
      (mutatedNodes: Map<NodeKey, NodeMutation>, editorInstance: LexicalEditor) => {
        editorInstance.getEditorState().read(() => {
          const freshStoreState = useAudioRecordingStore.getState();
          if (
            !freshStoreState.isRecordingActive ||
            !freshStoreState.currentRecordingId ||
            !freshStoreState.currentRecordingFilePath ||
            freshStoreState.currentRecordingOffsetMs === undefined ||
            freshStoreState.currentRecordingOffsetMs === null 
          ) {
            return;
          }

          for (const [nodeKey, mutation] of mutatedNodes) {
            if (processedNodesForCurrentRecording.has(nodeKey)) {
                continue;
            }

            if (mutation === 'created') {
              const createdNode = $getNodeByKey(nodeKey);

              if (isReplaceableEmptyBlock(createdNode)) {
                const audioBlockNode = $createAudioBlockNode(
                  freshStoreState.currentRecordingFilePath,
                  freshStoreState.currentRecordingId,
                  freshStoreState.currentRecordingOffsetMs
                );

                // This must be done in a editor.update() call
                editor.update(() => {
                    const nodeToReplace = $getNodeByKey(nodeKey); 
                    if (nodeToReplace && isReplaceableEmptyBlock(nodeToReplace)) { 
                        nodeToReplace.replace(audioBlockNode);

                        const newParagraph = $createParagraphNode();
                        audioBlockNode.insertAfter(newParagraph);
                        // Consider selecting the new paragraph for immediate typing
                        // newParagraph.select(); // This might need to be editor.setSelection(...) after node is attached

                        console.log(
                            `AutoTimestamp: Replaced new block (Key: ${nodeKey}) with AudioBlockNode (Key: ${audioBlockNode.getKey()}). ` +
                            `File: ${freshStoreState.currentRecordingFilePath}, ` +
                            `RecID: ${freshStoreState.currentRecordingId}, ` +
                            `Offset: ${freshStoreState.currentRecordingOffsetMs}`
                        );

                        invoke('create_audio_block_reference', {
                          recordingId: freshStoreState.currentRecordingId!, // Non-null asserted due to checks
                          blockId: audioBlockNode.getKey(), 
                          audioOffsetMs: freshStoreState.currentRecordingOffsetMs,
                        })
                          .then(() => {
                            console.log(`AutoTimestamp: Successfully created DB reference for AudioBlock ${audioBlockNode.getKey()}`);
                          })
                          .catch(err => {
                            console.error(`AutoTimestamp: Failed to create DB reference for AudioBlock ${audioBlockNode.getKey()}:`, err);
                          });
                        
                        // Add the NEW AudioBlockNode's key to processed set
                        // Must use functional update for useState when depending on previous state
                        setProcessedNodesForCurrentRecording(prev => new Set(prev).add(audioBlockNode.getKey()));
                    }
                }, { tag: 'auto-timestamp-insert' }); 
                
                // Break after handling one replaceable block to avoid complex cascading updates within a single mutation event.
                // The plugin will catch subsequent creations if necessary.
                break; 
              }
            }
          }
        });
      }
    );

    return () => {
      unregisterMutationListener();
    };
  }, [editor, isRecordingActive, currentRecordingId, currentRecordingFilePath, currentRecordingOffsetMs, processedNodesForCurrentRecording, setProcessedNodesForCurrentRecording]);
  // Added setProcessedNodesForCurrentRecording to dep array as it's used in an update

  return null;
}
