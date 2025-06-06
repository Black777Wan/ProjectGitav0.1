import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface AudioContextType {
  isRecording: boolean;
  isPaused: boolean;
  audioFile: string | null;
  currentTimestamp: number | null;
  startRecording: (pagePath: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  getTimestamp: () => Promise<number>;
  playAudioFromTimestamp: (audioFile: string, timestamp: number) => void;
}

const defaultContext: AudioContextType = {
  isRecording: false,
  isPaused: false,
  audioFile: null,
  currentTimestamp: null,
  startRecording: async () => {},
  stopRecording: async () => {},
  pauseRecording: () => {},
  resumeRecording: () => {},
  getTimestamp: async () => 0,
  playAudioFromTimestamp: () => {},
};

const AudioContext = createContext<AudioContextType>(defaultContext);

export const useAudio = () => useContext(AudioContext);

interface AudioProviderProps {
  children: ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    setAudioElement(audio);
    
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const startRecording = async (pagePath: string) => {
    try {
      const filePath = await invoke<string>('start_recording', { pagePath });
      setAudioFile(filePath);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = async () => {
    try {
      await invoke('stop_recording');
      setIsRecording(false);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  const pauseRecording = () => {
    // Note: This doesn't actually pause the backend recording
    // It just updates the UI state. The recording continues in the backend.
    setIsPaused(true);
  };

  const resumeRecording = () => {
    setIsPaused(false);
  };

  const getTimestamp = async (): Promise<number> => {
    if (!isRecording) {
      return 0;
    }

    try {
      const timestamp = await invoke<number>('get_recording_timestamp_ms');
      setCurrentTimestamp(timestamp);
      return timestamp;
    } catch (err) {
      console.error('Failed to get timestamp:', err);
      return 0;
    }
  };

  const playAudioFromTimestamp = (audioFilePath: string, timestampMs: number) => {
    if (!audioElement) return;
    
    // Convert from ms to seconds for audio element
    const timestampSec = timestampMs / 1000;
    
    // Set the audio source if it's different
    if (audioElement.src !== `file://${audioFilePath}`) {
      audioElement.src = `file://${audioFilePath}`;
    }
    
    // Set the current time and play
    audioElement.currentTime = timestampSec;
    audioElement.play().catch(err => {
      console.error('Failed to play audio:', err);
    });
  };

  return (
    <AudioContext.Provider
      value={{
        isRecording,
        isPaused,
        audioFile,
        currentTimestamp,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        getTimestamp,
        playAudioFromTimestamp,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
