import React, { useState, useEffect, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { FiClock, FiPlay, FiTrash2, FiLoader } from 'react-icons/fi';
import { AudioRecording } from '../types';
import { getAudioRecordings } from '../api/audio';
import AudioPlayer from './AudioPlayer';

interface AudioRecordingsListProps {
  noteId: string;
}

const AudioRecordingsList: React.FC<AudioRecordingsListProps> = ({ noteId }) => {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For loading the list of recordings
  const [error, setError] = useState<string | null>(null); // For errors during list loading
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null); // ID of the currently expanded recording

  // State for the currently expanded recording's playable audio source and related errors/loading
  const [currentPlayableSrc, setCurrentPlayableSrc] = useState<string | null>(null); // Asset URL from convertFileSrc
  const [conversionError, setConversionError] = useState<string | null>(null); // Error during convertFileSrc
  const [isConvertingSrc, setIsConvertingSrc] = useState(false); // True while convertFileSrc is running

  // Load recordings when the component mounts or noteId changes
  useEffect(() => {
    const loadRecordings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const recordingsData = await getAudioRecordings(noteId);
        setRecordings(recordingsData);
      } catch (err) {
        console.error('Failed to load recordings:', err);
        setError('Failed to load recordings');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRecordings();
  }, [noteId]);

  // Format the recording date
  const formatRecordingDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format the duration
  const formatDuration = (durationMs: number) => {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Toggles the expanded state for a recording item.
   * When a recording is expanded, its `filePath` is converted to a playable
   * URL using Tauri's `convertFileSrc`. This URL is then used by the AudioPlayer.
   * Handles loading and error states for this conversion process.
   */
  const toggleExpanded = useCallback(async (recordingId: string) => {
    setConversionError(null);
    setCurrentPlayableSrc(null);

    if (expandedRecordingId === recordingId) {
      // If already expanded, collapse it
      setExpandedRecordingId(null);
    } else {
      // If different recording or none expanded, expand this one
      setExpandedRecordingId(recordingId);
      const recording = recordings.find(r => r.id === recordingId);
      if (recording) {
        setIsConvertingSrc(true); // Indicate that we are preparing the audio source
        try {
          // `convertFileSrc` is essential for Tauri to serve local files to the webview.
          // It transforms a local file path into a URL like `asset://localhost/path/to/file`.
          const playableSrc = convertFileSrc(recording.filePath);
          setCurrentPlayableSrc(playableSrc);
        } catch (e) {
          console.error("Error converting file path for playback:", recording.filePath, e);
          setConversionError("Could not load audio. File path may be invalid or inaccessible.");
          setCurrentPlayableSrc(null);
        } finally {
          setIsConvertingSrc(false); // Conversion attempt finished
        }
      }
    }
  }, [expandedRecordingId, recordings]); // Depends on current expanded ID and the list of recordings

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4">Audio Recordings</h3>
      
      {isLoading ? (
        <div className="text-center text-obsidian-muted py-4">Loading recordings...</div>
      ) : error ? (
        <div className="text-center text-red-500 py-4">{error}</div>
      ) : recordings.length === 0 ? (
        <div className="text-center text-obsidian-muted py-4">No recordings found for this note</div>
      ) : (
        <div className="space-y-4">
          {recordings.map((recording) => (
            <div 
              key={recording.id} 
              className="bg-obsidian-active rounded-md p-3 border border-obsidian-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <button
                    onClick={() => toggleExpanded(recording.id)}
                    className="p-2 rounded-full bg-obsidian-accent text-white mr-3 flex items-center justify-center"
                    title={expandedRecordingId === recording.id ? "Hide Player" : "Show Player"}
                    disabled={isConvertingSrc && expandedRecordingId === recording.id}
                  >
                    {isConvertingSrc && expandedRecordingId === recording.id ? (
                      <FiLoader size={14} className="animate-spin" />
                    ) : (
                      <FiPlay size={14} />
                    )}
                  </button>
                  <div>
                    <div className="text-sm font-medium">
                      Recording {new Date(parseInt(recording.id.split('_')[1])).toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-obsidian-muted flex items-center">
                      <FiClock size={12} className="mr-1" />
                      {formatRecordingDate(recording.recordedAt)} • {formatDuration(recording.duration)}
                    </div>
                  </div>
                </div>
                <button
                  className="p-1.5 text-obsidian-muted hover:text-red-500 rounded hover:bg-obsidian-hover"
                  title="Delete Recording"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
              
              {expandedRecordingId === recording.id && (
                <div className="mt-3">
                  {isConvertingSrc ? (
                    <div className="text-center text-obsidian-muted text-sm py-2">Loading player...</div>
                  ) : conversionError ? (
                    <div className="text-center text-red-500 text-sm py-2">{conversionError}</div>
                  ) : currentPlayableSrc ? (
                    <AudioPlayer
                      audioSrc={currentPlayableSrc}
                      startTime={0}
                    />
                  ) : (
                    <div className="text-center text-obsidian-muted text-sm py-2">Could not load audio player.</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioRecordingsList;

