import { create } from 'zustand';

interface AudioRecordingState {
  isRecordingActive: boolean;
  currentRecordingId: string | null;
  recordingStartTimeClient: number | null; // Timestamp (Date.now()) when recording started on client
  currentRecordingOffsetMs: number;
  currentRecordingFilePath: string | null; // Added field
  actions: {
    startRecording: (recordingId: string, filePath: string) => void; // Updated signature
    stopRecording: () => void;
    setOffsetMs: (offset: number) => void; // For timer updates
  };
}

export const useAudioRecordingStore = create<AudioRecordingState>((set) => ({
  isRecordingActive: false,
  currentRecordingId: null,
  recordingStartTimeClient: null,
  currentRecordingOffsetMs: 0,
  currentRecordingFilePath: null, // Initialize
  actions: {
    startRecording: (recordingId: string, filePath: string) => // Updated signature
      set({
        isRecordingActive: true,
        currentRecordingId: recordingId,
        recordingStartTimeClient: Date.now(),
        currentRecordingOffsetMs: 0,
        currentRecordingFilePath: filePath, // Set filePath
      }),
    stopRecording: () =>
      set({
        isRecordingActive: false,
        currentRecordingId: null,
        recordingStartTimeClient: null,
        currentRecordingOffsetMs: 0,
        currentRecordingFilePath: null, // Reset filePath
      }),
    setOffsetMs: (offset: number) =>
      set({
        currentRecordingOffsetMs: offset,
      }),
  },
}));

// Optional: Export actions separately if preferred for usage, though often accessed via store.actions
// export const useAudioRecordingActions = () => useAudioRecordingStore((state) => state.actions);
// export const selectIsRecordingActive = (state: AudioRecordingState) => state.isRecordingActive;
// export const selectCurrentRecordingId = (state: AudioRecordingState) => state.currentRecordingId;
// export const selectRecordingStartTimeClient = (state: AudioRecordingState) => state.recordingStartTimeClient;
// export const selectCurrentRecordingOffsetMs = (state: AudioRecordingState) => state.currentRecordingOffsetMs;
