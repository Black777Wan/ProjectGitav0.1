import React, { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiSkipBack, FiSkipForward } from 'react-icons/fi';

interface AudioPlayerProps {
  audioSrc: string;
  startTime?: number; // Start time in milliseconds
  endTime?: number;   // End time in milliseconds for playing a segment
  onTimeUpdate?: (currentTime: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioSrc,
  startTime = 0,
  endTime,
  onTimeUpdate,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // Store actual current time from audio element, relative to start of file
  const [actualCurrentTime, setActualCurrentTime] = useState(startTime);
  const [fileDuration, setFileDuration] = useState(0); // Duration of the entire audio file
  const [isLoading, setIsLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Calculate segment-specific values
  const segmentStartTime = startTime;
  const segmentEndTime = endTime;
  const segmentDuration = segmentEndTime !== undefined ? segmentEndTime - segmentStartTime : fileDuration;

  // Current time relative to the segment's start
  const displayCurrentTime = Math.max(0, actualCurrentTime - segmentStartTime);

  /**
   * Effect to handle changes to the `audioSrc` prop.
   * When the source changes, it resets loading and playback states,
   * pauses any current playback, and explicitly calls `load()` on the
   * audio element to ensure the new source is fetched.
   */
  useEffect(() => {
    setIsLoading(true);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load(); // Important to re-load for new src
    }
  }, [audioSrc]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const initializeAudio = () => {
      const initialTimeSec = segmentStartTime / 1000;
      if (audioElement.duration && initialTimeSec < audioElement.duration) {
        audioElement.currentTime = initialTimeSec;
      } else if (initialTimeSec === 0) {
         audioElement.currentTime = 0;
      }
      // Sync state after explicitly setting currentTime
      setActualCurrentTime(audioElement.currentTime * 1000);
    };

    const handleLoadedMetadata = () => {
      setFileDuration(audioElement.duration * 1000); // Convert seconds to ms
      setIsLoading(false);
      initializeAudio();
    };

    const handleTimeUpdate = () => {
      if (!audioElement) return;
      const currentActualMs = audioElement.currentTime * 1000;
      setActualCurrentTime(currentActualMs);

      if (onTimeUpdate) {
        onTimeUpdate(currentActualMs);
      }

      // Check if segment end time is reached
      if (segmentEndTime !== undefined && currentActualMs >= segmentEndTime) {
        audioElement.pause();
        setIsPlaying(false);
        // Optional: Snap to segmentEndTime for display or if replaying segment
        // audioElement.currentTime = segmentEndTime / 1000;
        // setActualCurrentTime(segmentEndTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      // If it's a segment and ended naturally before segmentEndTime,
      // or if it's not a segment, this is normal.
      // If segmentEndTime is defined, handleTimeUpdate should have caught it.
      // We can ensure it's at the segment end if desired.
      if (segmentEndTime !== undefined) {
         setActualCurrentTime(segmentEndTime);
         if(audioElement.currentTime * 1000 < segmentEndTime) {
            audioElement.currentTime = segmentEndTime / 1000;
         }
      }
    };
    
    // Set current time if audio is already loaded and startTime changes
    if (!isLoading && audioElement.readyState > 0) {
       initializeAudio();
    }

    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('ended', handleEnded);
    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setIsLoading(false);
    };
    audioElement.addEventListener('error', handleError);

    return () => {
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
    };
  }, [audioSrc, segmentStartTime, segmentEndTime, onTimeUpdate, isLoading]); // Re-run if key segment props change or isLoading state changes

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Ensure playback starts from the correct point if paused at segment end
      if (segmentEndTime !== undefined && actualCurrentTime >= segmentEndTime) {
        audioRef.current.currentTime = segmentStartTime / 1000;
        setActualCurrentTime(segmentStartTime);
      }
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };
  
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  const skipBackward = () => {
    if (!audioRef.current) return;
    const newTime = Math.max(segmentStartTime, actualCurrentTime - 5000); // Skip back 5s, but not before segment start
    audioRef.current.currentTime = newTime / 1000;
    setActualCurrentTime(newTime);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    const cap = segmentEndTime !== undefined ? segmentEndTime : fileDuration;
    const newTime = Math.min(cap, actualCurrentTime + 5000); // Skip forward 5s, but not past segment end (or file end)
    audioRef.current.currentTime = newTime / 1000;
    setActualCurrentTime(newTime);
  };

  const formatTime = (timeMs: number) => {
    if (isNaN(timeMs) || timeMs === undefined || timeMs < 0) timeMs = 0;
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekTimeSeconds = parseFloat(e.target.value);
    // The seek bar value is relative to the segment's start (0 to segmentDuration)
    // Convert it to absolute time in the audio file
    const absoluteSeekTimeMs = (seekTimeSeconds * 1000) + segmentStartTime;

    audioRef.current.currentTime = absoluteSeekTimeMs / 1000;
    setActualCurrentTime(absoluteSeekTimeMs);
  };

  const displayedDuration = segmentDuration > 0 ? segmentDuration : 0;
  const displayedCurrentSeekValue = displayCurrentTime / 1000;
  
  return (
    <div className="flex flex-col bg-obsidian-active rounded-md p-2 text-xs w-full max-w-xs">
      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      {/* Seek bar */}
      <div className="w-full mb-2">
        <input
          type="range"
          min="0"
          max={displayedDuration / 1000} // Max is segment duration
          step="0.01"
          value={displayedCurrentSeekValue} // Value is current time within segment
          onChange={handleSeek}
          className="w-full h-1 bg-obsidian-border rounded-full appearance-none cursor-pointer"
          disabled={isLoading}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={skipBackward}
            className="text-obsidian-muted hover:text-obsidian-text"
            title="Skip back 5 seconds"
            disabled={isLoading}
          >
            <FiSkipBack size={14} />
          </button>
          
          <button 
            onClick={togglePlay}
            className="audio-button"
            title={isPlaying ? "Pause" : "Play"}
            disabled={isLoading}
          >
            {isPlaying ? <FiPause size={12} /> : <FiPlay size={12} />}
          </button>
          
          <button 
            onClick={skipForward}
            className="text-obsidian-muted hover:text-obsidian-text"
            title="Skip forward 5 seconds"
            disabled={isLoading}
          >
            <FiSkipForward size={14} />
          </button>
        </div>
        
        <span className="text-obsidian-text mx-2 tabular-nums">
          {isLoading ? "Loading..." : `${formatTime(displayCurrentTime)} / ${formatTime(displayedDuration)}`}
        </span>

        <button
          onClick={toggleMute}
          className="text-obsidian-muted hover:text-obsidian-text"
          title={isMuted ? "Unmute" : "Mute"}
          disabled={isLoading}
        >
          {isMuted ? <FiVolumeX size={14} /> : <FiVolume2 size={14} />}
        </button>
      </div>
    </div>
  );
};

export default AudioPlayer;

