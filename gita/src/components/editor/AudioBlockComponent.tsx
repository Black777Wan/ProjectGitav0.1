import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/tauri'; // Import for tauri
import AudioPlayer from '../AudioPlayer';
// import { getAudioBlockReferences } from '../../api/audio'; // This import seems unused here

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
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const [playableAudioSrc, setPlayableAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    if (audioFilePath) {
      setIsLoading(true);
      setError(null);
      try {
        // Ensure this runs only on the client-side if it's in a component that might be SSR'd (not an issue for Tauri)
        const src = convertFileSrc(audioFilePath);
        setPlayableAudioSrc(src);
        setIsLoading(false);
      } catch (e) {
        console.error("Error converting file path for audio block:", audioFilePath, e);
        setError("Failed to load audio source. Check console for details.");
        setIsLoading(false);
      }
    } else {
      setError("Audio file path is not provided.");
      setIsLoading(false);
    }
  }, [audioFilePath]);

  // Function to toggle the expanded state
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

