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
import { FiPlay, FiLoader, FiAlertTriangle } from 'react-icons/fi'; // Added icons

// Helper to format time from milliseconds to MM:SS
const formatTime = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const AudioBlockComponent: React.FC<AudioBlockComponentProps> = ({
  blockId,
  recordingId, // recordingId might be useful for context or debugging, but not directly used in UI now
  audioFilePath,
  startTime
}) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playableAudioSrc, setPlayableAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    if (audioFilePath) {
      setIsLoading(true);
      setError(null);
      setPlayableAudioSrc(null); // Reset playable src while loading new path
      try {
        const src = convertFileSrc(audioFilePath);
        setPlayableAudioSrc(src);
        setIsLoading(false);
      } catch (e) {
        console.error(`Error converting file path for audio block ${blockId}:`, audioFilePath, e);
        setError("Failed to load audio.");
        setIsLoading(false);
      }
    } else {
      setError("No audio path.");
      setIsLoading(false);
    }
  }, [audioFilePath, blockId]);

  const handlePlayButtonClick = () => {
    if (isLoading || error) return; // Don't toggle if loading or error
    setShowPlayer(!showPlayer);
  };

  // Optional: Function to handle time updates from the audio player if needed later
  // const handleTimeUpdate = (currentTime: number) => {
  //   console.log(`Audio time update for block ${blockId}: ${currentTime}ms`);
  // };

  if (isLoading) {
    return (
      <span className="inline-flex items-center align-middle mx-1 p-1 text-obsidian-muted" title="Loading audio...">
        <FiLoader className="animate-spin" size={14} />
      </span>
    );
  }

  if (error || !audioFilePath) { // If audioFilePath itself is missing, it's an error state
    return (
      <span className="inline-flex items-center align-middle mx-1 p-1 text-red-500" title={error || "Audio path missing"}>
        <FiAlertTriangle size={14} />
      </span>
    );
  }

  // If playableAudioSrc is null but there was no error and not loading, it means conversion failed unexpectedly or path was invalid from start.
  // This case is now covered by the error state more explicitly.

  return (
    <span className="inline-block align-middle mx-1 relative" data-block-id={blockId} data-recording-id={recordingId}>
      <button
        onClick={handlePlayButtonClick}
        title={`Play audio from ${formatTime(startTime)}`}
        className="p-1 rounded hover:bg-obsidian-hover focus:outline-none focus:ring-1 focus:ring-obsidian-accent text-obsidian-accent disabled:opacity-50"
        disabled={!playableAudioSrc} // Disable if src isn't ready (though error/loading state should catch this)
      >
        <FiPlay size={14} />
      </button>
      {showPlayer && playableAudioSrc && (
        <div
          className="absolute z-20 p-2 bg-obsidian-bg-dark border border-obsidian-border rounded shadow-lg mt-1"
          style={{
            // Basic popover positioning - might need adjustment based on editor layout
            // left: '0', // Align with button
            // top: '100%', // Position below button
            // More robust positioning might use a portal and calculate position
            minWidth: '280px', // Ensure player has some width
          }}
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside player from closing it if handled by an outer click elsewhere
        >
          <AudioPlayer
            audioSrc={playableAudioSrc}
            startTime={startTime / 1000} // AudioPlayer expects startTime in seconds
            // blockId={blockId} // Pass if AudioPlayer uses it
            // onTimeUpdate={handleTimeUpdate} // Optional
            autoPlay={true} // Start playing when shown
          />
        </div>
      )}
    </span>
  );
};

export default AudioBlockComponent;

