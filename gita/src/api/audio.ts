import { invoke } from '@tauri-apps/api/core';
import { AudioRecording, AudioBlockReference } from '../types';

// Start recording
export async function startRecording(noteId: string, recordingId: string): Promise<string> {
  return invoke('start_recording', { noteId, recordingId });
}

// Stop recording
export async function stopRecording(recordingId: string): Promise<void> {
  return invoke('stop_recording', { recordingId });
}

// Get audio recordings for a note
export async function getAudioRecordings(noteId: string): Promise<AudioRecording[]> {
  return invoke('get_audio_recordings', { noteId });
}

// Get audio block references for a recording
export async function getAudioBlockReferences(recordingId: string): Promise<AudioBlockReference[]> {
  return invoke('get_audio_block_references', { recordingId });
}

// Create an audio block reference
export async function createAudioBlockReference(
  recordingId: string,
  blockId: string,
  audioOffsetMs: number
): Promise<AudioBlockReference> {
  return invoke('create_audio_block_reference', { recordingId, blockId, audioOffsetMs });
}

