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
  $createParagraphNode,
  $isRootNode,
  ElementNode,
} from 'lexical';
import { useAudioRecordingStore } from '../../../../stores/audioRecordingStore';
import { invoke } from '@tauri-apps/api/tauri';
import { $createAudioBlockNode, AudioBlockNode } from '../nodes/AudioBlockNode'; // Import AudioBlockNode related items

// Helper function to check if a node is a "taggable" block type that should be replaced by an AudioBlockNode
const isReplaceableEmptyBlock = (node: any): boolean => {
  if (!node) return false;
  // Only target empty Paragraphs, Headings, or ListItems for replacement
  if (($isParagraphNode(node) || $isHeadingNode(node) || $isListItemNode(node)) && node.getChildrenSize() === 0) {
    // Further check: ensure it's a direct child of root or a list,
    // to avoid replacing nodes nested deeply in other structures unexpectedly.
    // This might need adjustment based on desired behavior.
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
    currentRecordingFilePath // Get the file path
  } = useAudioRecordingStore(
    (state) => ({
      isRecordingActive: state.isRecordingActive,
      currentRecordingId: state.currentRecordingId,
      currentRecordingOffsetMs: state.currentRecordingOffsetMs,
      currentRecordingFilePath: state.currentRecordingFilePath,
    })
  );

  // Keep track of nodes processed for the current recording to avoid duplicates
  const [processedNodesForCurrentRecording, setProcessedNodesForCurrentRecording] = useState<Set<NodeKey>>(new Set());

  // Store the recording ID for which nodes were processed to reset the set on new recording
  const lastProcessedRecordingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor) return;

    // If recording ID changes, reset the processed nodes set
    if (currentRecordingId !== lastProcessedRecordingIdRef.current) {
      setProcessedNodesForCurrentRecording(new Set());
      lastProcessedRecordingIdRef.current = currentRecordingId;
    }

    if (!isRecordingActive || !currentRecordingId || !currentRecordingFilePath) {
      // If not recording, or no recording ID, or no file path, nothing to do.
      return;
    }

    const unregisterMutationListener = editor.registerMutationListener(
      (mutatedNodes: Map<NodeKey, NodeMutation>, editorInstance: LexicalEditor) => {
        // Use the editorInstance from the listener for the current transaction
        editorInstance.getEditorState().read(() => {
          // Re-check store state inside read to ensure it's current for this transaction
          const freshStoreState = useAudioRecordingStore.getState();
          if (
            !freshStoreState.isRecordingActive ||
            !freshStoreState.currentRecordingId ||
            !freshStoreState.currentRecordingFilePath ||
            freshStoreState.currentRecordingOffsetMs === undefined || // Check for undefined explicitly
            freshStoreState.currentRecordingOffsetMs === null
          ) {
            return;
          }

          for (const [nodeKey, mutation] of mutatedNodes) {
            // Avoid processing nodes if already in the set for this recording
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

                // Replace the newly created empty block
                // This must be done in a subsequent editor.update() call to avoid issues with ongoing reconciliation.
                editor.update(() => {
                    const nodeToReplace = $getNodeByKey(nodeKey); // Re-fetch node in this update cycle
                    if (nodeToReplace && isReplaceableEmptyBlock(nodeToReplace)) { // Double check condition
                        nodeToReplace.replace(audioBlockNode);

                        // Optionally, insert a new paragraph after the audio block for better UX
                        const newParagraph = $createParagraphNode();
                        audioBlockNode.insertAfter(newParagraph);
                        // newParagraph.select(); // TODO: This causes issues. Selection needs careful handling.
                                                // For now, focus will likely remain on the AudioBlockNode or its container.
                                                // A better UX might be to set selection to the start of the new paragraph:
                                                // This requires the newParagraph to be attached to the tree.
                                                // editor.setSelection(newParagraph.selectStart());

                        console.log(
                            `AutoTimestamp: Replaced new block (Key: ${nodeKey}) with AudioBlockNode (Key: ${audioBlockNode.getKey()}). ` +
                            `File: ${freshStoreState.currentRecordingFilePath}, ` +
                            `RecID: ${freshStoreState.currentRecordingId}, ` +
                            `Offset: ${freshStoreState.currentRecordingOffsetMs}`
                        );

                        invoke('create_audio_block_reference', {
                          recordingId: freshStoreState.currentRecordingId!,
                          blockId: audioBlockNode.getKey(), // Use AudioBlockNode's key
                          audioOffsetMs: freshStoreState.currentRecordingOffsetMs,
                        })
                          .then(() => {
                            console.log(`AutoTimestamp: Successfully created DB reference for AudioBlock ${audioBlockNode.getKey()}`);
                          })
                          .catch(err => {
                            console.error(`AutoTimestamp: Failed to create DB reference for AudioBlock ${audioBlockNode.getKey()}:`, err);
                          });

                        // Add the NEW AudioBlockNode's key to processed set
                        setProcessedNodesForCurrentRecording(prev => new Set(prev).add(audioBlockNode.getKey()));
                    }
                }, { tag: 'auto-timestamp-insert' }); // Tag the update for debugging

                // Since we are replacing the node, we might also want to mark the original nodeKey as "processed"
                // to avoid re-evaluating it if the replacement somehow fails or causes another mutation.
                // However, adding the new audioBlockNode's key is more accurate for what we've actually timestamped.
                // We need to be careful here not to add the original nodeKey if it was successfully replaced.
                // The current logic adds the audioBlockNode.getKey().
              }
            }
          }
        });
      }
    );

    return () => {
      unregisterMutationListener();
    };
  }, [editor, isRecordingActive, currentRecordingId, currentRecordingFilePath, currentRecordingOffsetMs, processedNodesForCurrentRecording]);
  // Note: currentRecordingOffsetMs is in the dep array. This means the listener might re-register frequently.
  // This is generally fine, but if performance issues arise, this could be optimized by
  // getting the latest offset from the store directly inside the mutation callback via store.getState(),
  // and removing currentRecordingOffsetMs from the dependency array.
  // For now, this is okay.

  return null;
}
