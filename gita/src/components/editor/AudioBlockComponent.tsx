import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/tauri'; // Import for tauri
import AudioPlayer from '../AudioPlayer';

interface AudioBlockComponentProps {
  blockId: string;
  recordingId: string;
  audioFilePath: string; // Changed from audioSrc
  startTime: number;
}

const AudioBlockComponent: React.FC<AudioBlockComponentProps> = ({
  blockId,
  recordingId,
  audioFilePath, // Changed from audioSrc
  startTime
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // isLoading: True when initially attempting to convert audioFilePath or if path changes.
  const [isLoading, setIsLoading] = useState(true);
  // error: Stores any error message from `convertFileSrc` or if path is missing.
  const [error, setError] = useState<string | null>(null);
  // playableAudioSrc: Stores the result of `convertFileSrc` (e.g., "asset://localhost/...").
  const [playableAudioSrc, setPlayableAudioSrc] = useState<string | null>(null);

  /**
   * Effect to convert the local `audioFilePath` into a playable URL using Tauri's `convertFileSrc`.
   * This is necessary because webviews cannot directly access arbitrary local file system paths.
   * `convertFileSrc` generates a URL (e.g., asset://localhost/path/to/file) that Tauri's asset protocol can serve.
   * This effect runs when `audioFilePath` changes.
   */
  useEffect(() => {
    if (audioFilePath) {
      setIsLoading(true);
      setError(null);
      try {
        // `convertFileSrc` must be called on the client-side.
        // In Tauri, components are client-side, so this is fine.
        const src = convertFileSrc(audioFilePath);
        setPlayableAudioSrc(src);
      } catch (e) {
        console.error("Error converting file path for audio block:", audioFilePath, e);
        setError("Failed to load audio source. File path may be invalid or inaccessible.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setError("Audio file path is not provided.");
      setIsLoading(false); // Ensure loading stops if no path
    }
  }, [audioFilePath]);

  // Function to toggle the expanded state for the AudioPlayer
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Function to handle time updates from the audio player
  const handleTimeUpdate = (currentTime: number) => {
    // This could be used to highlight text in the editor that corresponds to this audio timestamp
    console.log(`Audio time update for block ${blockId}: ${currentTime}ms`);
  };

  return (
    <div className="my-2 p-2 bg-obsidian-active rounded border-l-2 border-obsidian-accent">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="text-xs text-obsidian-muted mr-2">Audio Block</span>
          <button
            onClick={toggleExpanded}
            className="text-xs text-obsidian-accent hover:underline"
          >
            {isExpanded ? 'Hide Player' : 'Show Player'}
          </button>
        </div>
        <span className="text-xs text-obsidian-muted">
          {new Date(parseInt(recordingId.split('_')[1])).toLocaleTimeString()}
        </span>
      </div>

      {isExpanded && (
        <div className="mt-2">
          {isLoading ? (
            <div className="text-center text-obsidian-muted text-sm py-2">Loading audio...</div>
          ) : error ? (
            <div className="text-center text-red-500 text-sm py-2">{error}</div>
          ) : playableAudioSrc ? (
            <AudioPlayer
              audioSrc={playableAudioSrc} // Use the converted src
              startTime={startTime}
              blockId={blockId}
              onTimeUpdate={handleTimeUpdate}
            />
          ) : (
            <div className="text-center text-obsidian-muted text-sm py-2">Audio not available.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioBlockComponent;

