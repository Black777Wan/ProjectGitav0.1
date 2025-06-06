import { create } from 'zustand';

interface AudioRecordingState {
  isRecordingActive: boolean;
  currentRecordingId: string | null;
  recordingStartTimeClient: number | null; // Timestamp (Date.now()) when recording started on client
  currentRecordingOffsetMs: number;
  actions: {
    startRecording: (recordingId: string) => void;
    stopRecording: () => void;
    setOffsetMs: (offset: number) => void; // For timer updates
  };
}

export const useAudioRecordingStore = create<AudioRecordingState>((set) => ({
  isRecordingActive: false,
  currentRecordingId: null,
  recordingStartTimeClient: null,
  currentRecordingOffsetMs: 0,
  actions: {
    startRecording: (recordingId: string) =>
      set({
        isRecordingActive: true,
        currentRecordingId: recordingId,
        recordingStartTimeClient: Date.now(),
        currentRecordingOffsetMs: 0,
      }),
    stopRecording: () =>
      set({
        isRecordingActive: false,
        currentRecordingId: null,
        recordingStartTimeClient: null,
        currentRecordingOffsetMs: 0,
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
