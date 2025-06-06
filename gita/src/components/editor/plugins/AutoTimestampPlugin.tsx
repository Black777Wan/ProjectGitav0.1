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
} from 'lexical';
import { useAudioRecordingStore } from '../../../../stores/audioRecordingStore';
import { invoke } from '@tauri-apps/api/tauri';

// Helper function to check if a node is a "taggable" block type
const isTaggableBlockNode = (node: any): boolean => {
  return node && ($isParagraphNode(node) || $isHeadingNode(node) || $isListItemNode(node));
};

export default function AutoTimestampPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { isRecordingActive, currentRecordingId, currentRecordingOffsetMs } = useAudioRecordingStore(
    (state) => ({
      isRecordingActive: state.isRecordingActive,
      currentRecordingId: state.currentRecordingId,
      currentRecordingOffsetMs: state.currentRecordingOffsetMs,
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

    if (!isRecordingActive || !currentRecordingId) {
      // If not recording, or no recording ID, nothing to do with mutations.
      // Also, if we just stopped recording, we might want to clear the processed set
      // (handled by currentRecordingId change check above for new recordings).
      return;
    }

    const unregisterMutationListener = editor.registerMutationListener(
      (mutatedNodes: Map<NodeKey, NodeMutation>, anEditor: LexicalEditor) => {
        // We need to ensure we are working with the latest editor state within this callback
        anEditor.getEditorState().read(() => {
          if (!isRecordingActive || !currentRecordingId || currentRecordingOffsetMs === undefined || currentRecordingOffsetMs === null) {
            // Check again, state might have changed
            return;
          }

          for (const [nodeKey, mutation] of mutatedNodes) {
            if (mutation === 'created' && !processedNodesForCurrentRecording.has(nodeKey)) {
              const node = $getNodeByKey(nodeKey);

              if (isTaggableBlockNode(node)) {
                // Additional check: ensure the node doesn't have a child that's already an audio block or similar decorator
                // This is a simple check; more robust logic might be needed for complex cases.
                let hasExistingAudioControl = false;
                if (node && typeof (node as any).getChildren === 'function') {
                    const children = (node as any).getChildren();
                    for (const child of children) {
                        if (child.getType() === 'audio-block') { // Assuming 'audio-block' is the type of AudioBlockNode
                            hasExistingAudioControl = true;
                            break;
                        }
                    }
                }
                if (hasExistingAudioControl) {
                    console.log(`AutoTimestamp: Node ${nodeKey} already contains an audio control, skipping.`);
                    setProcessedNodesForCurrentRecording(prev => new Set(prev).add(nodeKey)); // Mark as processed to avoid re-checking
                    continue;
                }


                const blockId = nodeKey; // Lexical node key can serve as blockId
                const timestampData = {
                  recordingId: currentRecordingId,
                  offsetMs: currentRecordingOffsetMs,
                };

                console.log(
                  `AutoTimestamp: New block (type: ${node?.getType()}, key: ${blockId}) created. Tagging with audio:`,
                  timestampData
                );

                invoke('create_audio_block_reference', {
                  recordingId: timestampData.recordingId,
                  blockId: blockId,
                  audioOffsetMs: timestampData.offsetMs,
                })
                  .then(() => {
                    console.log(`AutoTimestamp: Successfully created audio block reference for block ${blockId}`);
                  })
                  .catch(err => {
                    console.error(`AutoTimestamp: Failed to create audio block reference in DB for block ${blockId}:`, err);
                  });

                // Add to processed set for this recording session
                // Use functional update for setProcessedNodes to ensure we have the latest set
                setProcessedNodesForCurrentRecording(prev => new Set(prev).add(nodeKey));
              }
            }
          }
        });
      }
    );

    return () => {
      unregisterMutationListener();
    };
  // Ensure dependencies cover all reactive values from store and editor.
  // currentRecordingOffsetMs is included because its value at the time of creation is important.
  }, [editor, isRecordingActive, currentRecordingId, currentRecordingOffsetMs, processedNodesForCurrentRecording]);

  return null;
}
