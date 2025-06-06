import React, { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiSkipBack, FiSkipForward } from 'react-icons/fi';

interface AudioPlayerProps {
  audioSrc: string;
  startTime?: number; // Start time in milliseconds
  blockId?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioSrc, 
  startTime = 0, 
  blockId,
  onTimeUpdate 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    // Set the current time when the component mounts
    if (audioRef.current && startTime > 0) {
      audioRef.current.currentTime = startTime / 1000; // Convert ms to seconds
    }
  }, [startTime]);
  
  useEffect(() => {
    // Update duration when audio metadata is loaded
    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration * 1000); // Convert seconds to ms
        setIsLoading(false);
      }
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
    
    const audioElement = audioRef.current;
    if (audioElement) {
      audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.addEventListener('timeupdate', handleTimeUpdate);
      audioElement.addEventListener('ended', handleEnded);
      
      return () => {
        audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioElement.removeEventListener('timeupdate', handleTimeUpdate);
        audioElement.removeEventListener('ended', handleEnded);
      };
    }
  }, [onTimeUpdate]);
  
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
          max={audioRef.current?.duration || 0}
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
        
        <span className="text-obsidian-text mx-2">
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

