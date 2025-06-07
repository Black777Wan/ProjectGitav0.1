import { invoke } from '@tauri-apps/api/core';
import {
  startRecording,
  stopRecording,
  getAudioRecordings,
  getAudioBlockReferences,
  createAudioBlockReference,
} from './audio'; // Adjust path as necessary
import { AudioRecording, AudioBlockReference } from '../types'; // Adjust path as necessary

// Mock the tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

describe('audio API', () => {
  beforeEach(() => {
    (invoke as jest.Mock).mockClear();
  });

  it('startRecording should call invoke with correct command and parameters', async () => {
    const noteId = 'note-uuid-123';
    const recordingId = 'recording-uuid-456';
    (invoke as jest.Mock).mockResolvedValueOnce('path/to/recording.wav');

    const result = await startRecording(noteId, recordingId);

    expect(invoke).toHaveBeenCalledWith('start_recording', {
      note_id: noteId,
      recording_id: recordingId,
    });
    expect(result).toBe('path/to/recording.wav');
  });

  it('stopRecording should call invoke with correct command and recordingId', async () => {
    const recordingId = 'recording-uuid-789';
    const mockRecording: AudioRecording = {
      id: recordingId,
      note_id: 'note-uuid-123',
      file_path: 'path/to/recording.wav',
      created_at: 'timestamp',
      // Add other fields if necessary based on AudioRecording type
    };
    (invoke as jest.Mock).mockResolvedValueOnce(mockRecording);

    const result = await stopRecording(recordingId);

    expect(invoke).toHaveBeenCalledWith('stop_recording', { recording_id: recordingId });
    expect(result).toEqual(mockRecording);
  });

  it('getAudioRecordings should call invoke with correct command and noteId', async () => {
    const noteId = 'note-uuid-123';
    const mockRecordings: AudioRecording[] = [
      { id: 'rec-1', note_id: noteId, file_path: 'path/1.wav', created_at: 'ts1' },
      { id: 'rec-2', note_id: noteId, file_path: 'path/2.wav', created_at: 'ts2' },
    ];
    (invoke as jest.Mock).mockResolvedValueOnce(mockRecordings);

    const result = await getAudioRecordings(noteId);

    expect(invoke).toHaveBeenCalledWith('get_audio_recordings', { note_id: noteId });
    expect(result).toEqual(mockRecordings);
  });

  it('getAudioBlockReferences should call invoke with correct command and recordingId', async () => {
    const recordingId = 'recording-uuid-456';
    const mockReferences: AudioBlockReference[] = [
      { id: 'ref-1', recording_id: recordingId, block_id: 'block-uuid-1', audio_offset_ms: 1000 },
      { id: 'ref-2', recording_id: recordingId, block_id: 'block-uuid-2', audio_offset_ms: 2500 },
    ];
    (invoke as jest.Mock).mockResolvedValueOnce(mockReferences);

    const result = await getAudioBlockReferences(recordingId);

    expect(invoke).toHaveBeenCalledWith('get_audio_block_references', { recording_id: recordingId });
    expect(result).toEqual(mockReferences);
  });

  it('createAudioBlockReference should call invoke with correct command and parameters', async () => {
    const recordingId = 'recording-uuid-789';
    const blockId = 'block-uuid-3';
    const audioOffsetMs = 3000;
    const mockReference: AudioBlockReference = {
      id: 'ref-new',
      recording_id: recordingId,
      block_id: blockId,
      audio_offset_ms: audioOffsetMs,
    };
    (invoke as jest.Mock).mockResolvedValueOnce(mockReference);

    const result = await createAudioBlockReference(recordingId, blockId, audioOffsetMs);

    expect(invoke).toHaveBeenCalledWith('create_audio_block_reference', {
      recording_id: recordingId,
      block_id: blockId,
      audio_offset_ms: audioOffsetMs,
    });
    expect(result).toEqual(mockReference);
    // Ensure all IDs are passed as strings
    expect(typeof (invoke as jest.Mock).mock.calls[0][1].recording_id).toBe('string');
    expect(typeof (invoke as jest.Mock).mock.calls[0][1].block_id).toBe('string');
  });
});
