import React, { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiSkipBack, FiSkipForward } from 'react-icons/fi';

interface AudioPlayerProps {
  audioSrc: string;
  startTime?: number; // Start time in milliseconds
  onTimeUpdate?: (currentTime: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioSrc, 
  startTime = 0, 
  onTimeUpdate 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * Effect to handle changes to the `audioSrc` prop.
   * When the source changes, it resets loading and playback states,
   * pauses any current playback, and explicitly calls `load()` on the
   * audio element to ensure the new source is fetched.
   */
  useEffect(() => {
    setIsLoading(true);
    setIsPlaying(false);
    // setCurrentTime is not reset here; it will be updated by `handleLoadedMetadata`
    // or the `startTime` effect once the new audio is ready.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [audioSrc]);
  
  /**
   * Effect to handle setting the initial `currentTime` of the audio element.
   * This is primarily for the `startTime` prop.
   * It ensures that `currentTime` is set only when the audio element is ready
   * (readyState > 0, meaning at least metadata is available) or when `isLoading` is false.
   * The `handleLoadedMetadata` function also sets `currentTime` more definitively once duration is known.
   */
  useEffect(() => {
    if (audioRef.current && (audioRef.current.readyState > 0 || !isLoading)) {
      const newCurrentTimeInSeconds = startTime / 1000;
      // Only set if duration is known and new time is within bounds, or if setting to 0
      if (audioRef.current.duration && newCurrentTimeInSeconds < audioRef.current.duration) {
        audioRef.current.currentTime = newCurrentTimeInSeconds;
      } else if (newCurrentTimeInSeconds === 0) {
        audioRef.current.currentTime = 0;
      }
      // The local `currentTime` state will be updated by the `timeupdate` event listener.
    }
  }, [startTime, isLoading]); // Re-run if startTime changes or after metadata has loaded.
  
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleLoadedMetadata = () => {
      setDuration(audioElement.duration * 1000); // Convert seconds to ms
      setIsLoading(false);
      // Set initial time here as well, as this is when duration is known
      const initialTimeSec = startTime / 1000;
      if (initialTimeSec < audioElement.duration) {
        audioElement.currentTime = initialTimeSec;
      } else {
        audioElement.currentTime = 0; // Default to 0 if startTime is invalid
      }
      setCurrentTime(audioElement.currentTime * 1000); // Sync state
    };
    
    const handleTimeUpdate = () => {
      if (audioRef.current) {
        const currentTimeMs = audioRef.current.currentTime * 1000; // Convert seconds to ms
        setCurrentTime(currentTimeMs);
        if (onTimeUpdate) {
          onTimeUpdate(currentTimeMs);
        }
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('ended', handleEnded);
    // Handle cases where audio might fail to load
    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setIsLoading(false); // Stop loading indicator
      // Optionally, display an error message to the user via a new state
    };
    audioElement.addEventListener('error', handleError);
      
    return () => {
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
    };
  }, [onTimeUpdate, startTime, audioSrc]); // Add audioSrc to re-attach if source changes fundamentally
  
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => {
          console.error("Error playing audio:", error);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
    }
  };
  
  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration,
        audioRef.current.currentTime + 5
      );
    }
  };
  
  const formatTime = (timeMs: number) => {
    if (isNaN(timeMs) || timeMs === undefined) timeMs = 0;
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime * 1000);
    }
  };
  
  return (
    <div className="flex flex-col bg-obsidian-active rounded-md p-2 text-xs w-full max-w-xs">
      <audio ref={audioRef} src={audioSrc} preload="metadata" />
      
      {/* Seek bar */}
      <div className="w-full mb-2">
        <input
          type="range"
          min="0"
          max={duration / 1000 || 0}
          step="0.01"
          value={currentTime / 1000}
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
          {isLoading ? "Loading..." : `${formatTime(currentTime)} / ${formatTime(duration)}`}
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

