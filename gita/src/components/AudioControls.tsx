import React from 'react';
import { Mic, MicOff, Pause, Play } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';
import { useFileSystem } from '../contexts/FileSystemContext';
import clsx from 'clsx';

const AudioControls: React.FC = () => {
  const { 
    isRecording, 
    isPaused, 
    startRecording, 
    stopRecording, 
    pauseRecording,
    resumeRecording
  } = useAudio();
  
  const { currentFile } = useFileSystem();

  const handleRecordToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      if (!currentFile) {
        console.error('No file selected');
        return;
      }
      await startRecording(currentFile);
    }
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  return (
    <div className="audio-controls">
      <button 
        className={clsx(
          'audio-button',
          isRecording && 'active'
        )}
        onClick={handleRecordToggle}
        disabled={!currentFile}
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
      >
        {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      
      {isRecording && (
        <button 
          className={clsx(
            'audio-button',
            isPaused && 'active'
          )}
          onClick={handlePauseToggle}
          title={isPaused ? 'Resume Recording' : 'Pause Recording'}
        >
          {isPaused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      )}
      
      {isRecording && (
        <div className="text-xs text-text-muted ml-2">
          {isPaused ? 'Recording Paused' : 'Recording...'}
        </div>
      )}
    </div>
  );
};

export default AudioControls;
