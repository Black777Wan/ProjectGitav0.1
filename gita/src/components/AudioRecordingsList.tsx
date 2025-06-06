import React, { useState, useEffect } from 'react';
import { FiClock, FiPlay, FiTrash2, FiLoader, FiAlertTriangle } from 'react-icons/fi'; // Added Loader and AlertTriangle
import { AudioRecording } from '../types';
import { getAudioRecordings } from '../api/audio';
import AudioPlayer from './AudioPlayer';
import { convertFileSrc } from '@tauri-apps/api/tauri'; // Import convertFileSrc

// --- PlayableAudioItem Sub-component ---
interface PlayableAudioItemProps {
  filePath: string;
  startTime?: number; // Optional, defaults to 0
}

const PlayableAudioItem: React.FC<PlayableAudioItemProps> = ({ filePath, startTime = 0 }) => {
  const [playableSrc, setPlayableSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (filePath) {
      setIsLoading(true);
      setError(null);
      setPlayableSrc(null); // Reset before attempting to load
      try {
        const src = convertFileSrc(filePath);
        setPlayableSrc(src);
      } catch (e) {
        console.error(`Error converting file path ${filePath}:`, e);
        setError("Could not load audio source.");
        setPlayableSrc(null);
      } finally {
        setIsLoading(false);
      }
    } else {
      setError("No file path provided.");
      setIsLoading(false);
    }
  }, [filePath]);

  if (isLoading) return (
    <div className="text-xs text-obsidian-muted flex items-center">
      <FiLoader className="animate-spin mr-2" /> Loading player...
    </div>
  );
  if (error) return (
    <div className="text-xs text-red-500 flex items-center">
      <FiAlertTriangle className="mr-2" /> {error}
    </div>
  );
  if (!playableSrc) return (
    <div className="text-xs text-obsidian-muted">
      Audio not available.
    </div>
  );

  return <AudioPlayer audioSrc={playableSrc} startTime={startTime / 1000} />; // Assuming AudioPlayer expects seconds
};
// --- End PlayableAudioItem Sub-component ---


interface AudioRecordingsListProps {
  noteId: string;
}

const AudioRecordingsList: React.FC<AudioRecordingsListProps> = ({ noteId }) => {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null);

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

  // Toggle expanded state for a recording
  const toggleExpanded = (recordingId: string) => {
    if (expandedRecordingId === recordingId) {
      setExpandedRecordingId(null);
    } else {
      setExpandedRecordingId(recordingId);
    }
  };

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
                    className="p-2 rounded-full bg-obsidian-accent text-white mr-3"
                    title={expandedRecordingId === recording.id ? "Hide Player" : "Show Player"}
                  >
                    <FiPlay size={14} />
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
                  <PlayableAudioItem
                    filePath={recording.filePath}
                    // startTime is 0 for full playback here, PlayableAudioItem defaults to 0 if not provided
                    // AudioPlayer inside PlayableAudioItem will handle ms to seconds conversion if necessary
                  />
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

