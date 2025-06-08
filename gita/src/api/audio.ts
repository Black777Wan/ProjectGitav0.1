import { invoke } from '@tauri-apps/api/core';
import { AudioRecording, AudioBlockReference } from '../types';

// Start recording
export async function startRecording(noteId: string, recordingId: string): Promise<string> {
  return invoke('start_recording', { note_id: noteId, recording_id: recordingId });
}

// Stop recording
export async function stopRecording(recordingId: string): Promise<AudioRecording> {
  return invoke('stop_recording', { recording_id: recordingId });
}

// Get audio recordings for a note
export async function getAudioRecordings(noteId: string): Promise<AudioRecording[]> {
  return invoke('get_audio_recordings', { note_id: noteId });
}

// Get audio block references for a recording
export async function getAudioBlockReferences(recordingId: string): Promise<AudioBlockReference[]> {
  return invoke('get_audio_timestamps_for_recording', { recording_id: recordingId });
}

// Create an audio block reference
export async function createAudioBlockReference(
  recordingId: string,
  blockId: string,
  audioOffsetMs: number
): Promise<AudioBlockReference> {
  return invoke('add_audio_timestamp', {
    audio_recording_id: recordingId,
    block_id: blockId,
    timestamp_ms: audioOffsetMs
  });
}

