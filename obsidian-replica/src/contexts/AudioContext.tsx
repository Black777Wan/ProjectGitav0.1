import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { v4 as uuidv4 } from 'uuid';
import { useNotes } from './NotesContext';

type AudioDevice = {
  id: string;
  name: string;
  isDefault: boolean;
};

type AudioContextType = {
  // State
  isRecording: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentAudioFile: string | null;
  inputDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  selectedInputDevice: string | null;
  selectedOutputDevice: string | null;
  volume: number;
  isMuted: boolean;
  
  // Methods
  startRecording: (noteId: string) => Promise<void>;
  stopRecording: () => Promise<string | null>; // Returns the path to the recorded file
  togglePauseRecording: () => void;
  playAudio: (filePath: string, startTime?: number) => Promise<void>;
  pauseAudio: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  getAudioDevices: () => Promise<void>;
  getAudioDuration: (filePath: string) => Promise<number>;
  trimAudio: (filePath: string, startTime: number, endTime: number) => Promise<string>;
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const { addAudioTimestamp } = useNotes();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentAudioFile, setCurrentAudioFile] = useState<string | null>(null);
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string | null>(null);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(1); // 0 to 1
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>();
  const currentNoteIdRef = useRef<string | null>(null);

  // Initialize audio context and get devices
  useEffect(() => {
    const initAudio = async () => {
      try {
        await getAudioDevices();
        
        // Set up audio element
        if (typeof window !== 'undefined') {
          audioRef.current = new Audio();
          audioRef.current.volume = volume;
          audioRef.current.muted = isMuted;
          
          audioRef.current.addEventListener('timeupdate', updateTime);
          audioRef.current.addEventListener('ended', handleAudioEnded);
          audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        }
      } catch (err) {
        console.error('Failed to initialize audio:', err);
      }
    };
    
    initAudio();
    
    return () => {
      // Cleanup
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', updateTime);
        audioRef.current.removeEventListener('ended', handleAudioEnded);
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioRef.current = null;
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Stop any ongoing recording when unmounting
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  const updateTime = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    animationRef.current = requestAnimationFrame(updateTime);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const getAudioDevices = async () => {
    try {
      const devices = await invoke<{
        input: AudioDevice[];
        output: AudioDevice[];
      }>('get_audio_devices');
      
      setInputDevices(devices.input);
      setOutputDevices(devices.output);
      
      // Set default devices if not already set
      if (devices.input.length > 0 && !selectedInputDevice) {
        const defaultInput = devices.input.find(d => d.isDefault) || devices.input[0];
        setSelectedInputDevice(defaultInput.id);
      }
      
      if (devices.output.length > 0 && !selectedOutputDevice) {
        const defaultOutput = devices.output.find(d => d.isDefault) || devices.output[0];
        setSelectedOutputDevice(defaultOutput.id);
      }
    } catch (err) {
      console.error('Failed to get audio devices:', err);
    }
  };

  const startRecording = async (noteId: string) => {
    try {
      if (!selectedInputDevice) {
        throw new Error('No input device selected');
      }
      
      currentNoteIdRef.current = noteId;
      
      // Start recording via Tauri
      await invoke('start_recording', { 
        deviceId: selectedInputDevice,
        noteId
      });
      
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      throw err;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    try {
      if (!isRecording) return null;
      
      // Stop recording via Tauri and get the file path
      const filePath = await invoke<string>('stop_recording');
      
      setIsRecording(false);
      setCurrentAudioFile(filePath);
      
      return filePath;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsRecording(false);
      throw err;
    }
  };

  const togglePauseRecording = () => {
    // This would require support from the Tauri backend to pause/resume recording
    console.warn('Pause/resume recording not yet implemented');
  };

  const playAudio = async (filePath: string, startTime: number = 0) => {
    try {
      if (!audioRef.current) return;
      
      // If it's a different file, update the source
      if (audioRef.current.src !== filePath) {
        audioRef.current.src = filePath;
        await audioRef.current.load();
      }
      
      audioRef.current.currentTime = startTime;
      await audioRef.current.play();
      setIsPlaying(true);
      updateTime();
    } catch (err) {
      console.error('Failed to play audio:', err);
      throw err;
    }
  };

  const pauseAudio = () => {
    if (!audioRef.current) return;
    
    audioRef.current.pause();
    setIsPlaying(false);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const seekTo = (time: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const setVolume = (newVolume: number) => {
    const volumeValue = Math.max(0, Math.min(1, newVolume));
    setVolumeState(volumeValue);
    
    if (audioRef.current) {
      audioRef.current.volume = volumeValue;
    }
    
    // Unmute if volume is increased from 0
    if (volumeValue > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.muted = newMuted;
  };

  const setInputDevice = async (deviceId: string) => {
    try {
      await invoke('set_input_device', { deviceId });
      setSelectedInputDevice(deviceId);
    } catch (err) {
      console.error('Failed to set input device:', err);
      throw err;
    }
  };

  const setOutputDevice = async (deviceId: string) => {
    try {
      // For output device, we need to update the audio element's sinkId if supported
      if (audioRef.current && 'setSinkId' in audioRef.current) {
        try {
          await (audioRef.current as any).setSinkId(deviceId);
          setSelectedOutputDevice(deviceId);
        } catch (err) {
          console.error('Failed to set output device:', err);
          throw err;
        }
      } else {
        console.warn('setSinkId is not supported in this browser');
      }
    } catch (err) {
      console.error('Failed to set output device:', err);
      throw err;
    }
  };

  const getAudioDuration = async (filePath: string): Promise<number> => {
    try {
      return await invoke<number>('get_audio_duration', { filePath });
    } catch (err) {
      console.error('Failed to get audio duration:', err);
      return 0;
    }
  };

  const trimAudio = async (filePath: string, startTime: number, endTime: number): Promise<string> => {
    try {
      return await invoke<string>('trim_audio', { 
        filePath, 
        startTime, 
        endTime 
      });
    } catch (err) {
      console.error('Failed to trim audio:', err);
      throw err;
    }
  };

  return (
    <AudioContext.Provider
      value={{
        // State
        isRecording,
        isPlaying,
        currentTime,
        duration,
        currentAudioFile,
        inputDevices,
        outputDevices,
        selectedInputDevice,
        selectedOutputDevice,
        volume,
        isMuted,
        
        // Methods
        startRecording,
        stopRecording,
        togglePauseRecording,
        playAudio,
        pauseAudio,
        seekTo,
        setVolume,
        toggleMute,
        setInputDevice,
        setOutputDevice,
        getAudioDevices,
        getAudioDuration,
        trimAudio,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
