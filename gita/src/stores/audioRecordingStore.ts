import { create } from 'zustand';

interface AudioRecordingState {
  isRecordingActive: boolean;
  currentRecordingId: string | null;
  recordingStartTimeClient: number | null; // Timestamp (Date.now()) when recording started on client
  currentRecordingOffsetMs: number;
  currentRecordingFilePath: string | null; // From jules_wip: Anticipated path of the current recording
  actions: {
    startRecording: (recordingId: string, filePath: string) => void; // From jules_wip: includes filePath
    stopRecording: () => void;
    setOffsetMs: (offset: number) => void; // For timer updates
  };
}

export const useAudioRecordingStore = create<AudioRecordingState>((set) => ({
  isRecordingActive: false,
  currentRecordingId: null,
  recordingStartTimeClient: null,
  currentRecordingOffsetMs: 0,
  currentRecordingFilePath: null, // From jules_wip: Initialize
  actions: {
    startRecording: (recordingId: string, filePath: string) => // From jules_wip
      set({
        isRecordingActive: true,
        currentRecordingId: recordingId,
        recordingStartTimeClient: Date.now(),
        currentRecordingOffsetMs: 0,
        currentRecordingFilePath: filePath, // From jules_wip: Set filePath
      }),
    stopRecording: () =>
      set({
        isRecordingActive: false,
        currentRecordingId: null,
        recordingStartTimeClient: null,
        currentRecordingOffsetMs: 0,
        currentRecordingFilePath: null, // From jules_wip: Reset filePath
      }),
    setOffsetMs: (offset: number) =>
      set({
        currentRecordingOffsetMs: offset,
      }),
  },
}));

// Optional selectors (commented out in both versions, kept as is)
// export const useAudioRecordingActions = () => useAudioRecordingStore((state) => state.actions);
// export const selectIsRecordingActive = (state: AudioRecordingState) => state.isRecordingActive;
// export const selectCurrentRecordingId = (state: AudioRecordingState) => state.currentRecordingId;
// export const selectRecordingStartTimeClient = (state: AudioRecordingState) => state.recordingStartTimeClient;
// export const selectCurrentRecordingOffsetMs = (state: AudioRecordingState) => state.currentRecordingOffsetMs;
// export const selectCurrentRecordingFilePath = (state: AudioRecordingState) => state.currentRecordingFilePath; // If adding selector for new field
