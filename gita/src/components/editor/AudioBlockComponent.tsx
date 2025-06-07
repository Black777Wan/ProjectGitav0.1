  import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { convertFileSrc } from '@tauri-apps/api/core';
import AudioPlayer from '../AudioPlayer';
import { FiPlay, FiLoader, FiAlertTriangle } from 'react-icons/fi'; // From jules_wip

// Helper to format time from milliseconds to MM:SS (from jules_wip)
const formatTime = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface AudioBlockComponentProps {
  blockId: string;
  recordingId: string;
  audioFilePath: string;
  startTime: number; // Assuming this is in milliseconds
}

const AudioBlockComponent: React.FC<AudioBlockComponentProps> = ({
  blockId,
  recordingId,
  audioFilePath,
  startTime,
}) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playableAudioSrc, setPlayableAudioSrc] = useState<string | null>(null);
  const [endTimeMs, setEndTimeMs] = useState<number | null>(null); // Added state for endTime
  const playerPopupRef = useRef<HTMLDivElement>(null); // For click outside

  // Simulate fetching timestamp data (including endTime)
  useEffect(() => {
    // In a real scenario, you would fetch this data based on blockId or recordingId
    // For example: getAudioTimestampForBlock(blockId).then(data => setEndTimeMs(data.endTime));
    console.log(`Simulating fetch for audio timestamp for block: ${blockId}, recording: ${recordingId}`);
    // Simulate a 10-second segment if startTime is defined
    if (typeof startTime === 'number') {
      setEndTimeMs(startTime + 10000); // Simulate a 10-second segment
    }
  }, [blockId, recordingId, startTime]);

  useEffect(() => {
    if (audioFilePath) {
      setIsLoading(true);
      setError(null);
      setPlayableAudioSrc(null);
      try {
        const src = convertFileSrc(audioFilePath);
        setPlayableAudioSrc(src);
      } catch (e) {
        console.error(`Error converting file path for audio block ${blockId}:`, audioFilePath, e);
        // Use more detailed error message from main branch's logic
        setError("Failed to load audio source. File path may be invalid or inaccessible.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setError("No audio path provided.");
      setIsLoading(false);
    }
  }, [audioFilePath, blockId]);

  // Close popup if clicked outside (from jules_wip, enhanced)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (playerPopupRef.current && !playerPopupRef.current.contains(event.target as Node)) {
        setShowPlayer(false);
      }
    }
    if (showPlayer) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPlayer]);

  const handlePlayButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (isLoading || error || !playableAudioSrc) return;
    setShowPlayer(!showPlayer);
  };

  if (isLoading) {
    return (
      <span className="inline-flex items-center align-middle mx-1 p-1 text-light-muted dark:text-obsidian-muted" title="Loading audio...">
        <FiLoader className="animate-spin" size={14} />
      </span>
    );
  }

  if (error || !audioFilePath) {
    return (
      <span className="inline-flex items-center align-middle mx-1 p-1 text-red-500" title={error || "Audio path missing"}>
        <FiAlertTriangle size={14} />
      </span>
    );
  }
  
  // This case should ideally be covered by the error state if audioFilePath is present but conversion fails
  if (!playableAudioSrc) {
     return (
      <span className="inline-flex items-center align-middle mx-1 p-1 text-red-500" title="Audio source not ready.">
        <FiAlertTriangle size={14} />
      </span>
    );
  }

  return (
    <span className="inline-block align-middle mx-1 relative" data-block-id={blockId} data-recording-id={recordingId}>
      <button
        onClick={handlePlayButtonClick}
        title={`Play audio from ${formatTime(startTime)}`}
        className="p-1 rounded hover:bg-light-hover dark:hover:bg-obsidian-hover focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-obsidian-accent text-light-accent dark:text-obsidian-accent disabled:opacity-50"
      >
        <FiPlay size={14} />
      </button>
      {showPlayer && (
        <div
          ref={playerPopupRef}
          className="absolute z-20 p-2 bg-light-bg dark:bg-obsidian-bg border border-light-border dark:border-obsidian-border rounded shadow-lg mt-1"
          style={{
            left: '0', 
            top: '100%', 
            minWidth: '280px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <AudioPlayer
            audioSrc={playableAudioSrc}
            startTime={startTime} // AudioPlayer expects startTime in milliseconds
            endTime={endTimeMs ?? undefined} // Pass endTime to AudioPlayer
          />
        </div>
      )}
    </span>
  );
};

export default AudioBlockComponent;
