import React, { useState, useEffect } from 'react';
import { FiMic, FiMicOff, FiClock } from 'react-icons/fi';

interface AudioRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);

  // Start/stop the recording timer
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingInterval(interval);
      
      return () => {
        clearInterval(interval);
      };
    } else {
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
        setRecordingTime(0);
      }
    }
  }, [isRecording]);

  // Format the recording time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center">
      <button
        className={`p-2 rounded-full ${isRecording ? 'bg-red-600 text-white' : 'bg-obsidian-hover text-obsidian-text'}`}
        onClick={isRecording ? onStopRecording : onStartRecording}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isRecording ? <FiMicOff size={18} /> : <FiMic size={18} />}
      </button>
      
      {isRecording && (
        <div className="flex items-center ml-2 text-sm text-red-500">
          <FiClock className="mr-1 animate-pulse" />
          <span>{formatTime(recordingTime)}</span>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;

