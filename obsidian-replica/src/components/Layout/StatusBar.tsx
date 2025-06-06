import { useEffect, useState } from 'react';
import { useNotes } from '../../contexts/NotesContext';
import { useAudio } from '../../contexts/AudioContext';
import { format } from 'date-fns';
import { invoke } from '@tauri-apps/api/tauri';

export default function StatusBar() {
  const { currentNote } = useNotes();
  const { isRecording } = useAudio();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeState(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get memory usage (placeholder - would be implemented with Tauri backend)
  React.useEffect(() => {
    const getMemoryUsage = async () => {
      try {
        // This would be a Tauri command in a real implementation
        // const usage = await invoke('get_memory_usage');
        // setMemoryUsage(usage);
        setMemoryUsage(Math.random() * 100); // Random value for demo
      } catch (error) {
        console.error('Failed to get memory usage:', error);
      }
    };

    const interval = setInterval(getMemoryUsage, 5000);
    getMemoryUsage();
    return () => clearInterval(interval);
  }, []);

  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get memory usage color based on percentage
  const getMemoryColor = (usage: number): string => {
    if (usage > 90) return 'text-red-500';
    if (usage > 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className={`
      flex items-center justify-between px-4 py-1.5 text-xs
      ${theme === 'dark' ? 'bg-gray-800 text-gray-300 border-t border-gray-700' : 'bg-gray-100 text-gray-600 border-t border-gray-200'}
    `}>
      <div className="flex items-center space-x-4">
        {/* Recording Status */}
        <div className="flex items-center">
          {isRecording ? (
            <>
              <FiMic className="text-red-500 mr-1.5 animate-pulse" />
              <span>Recording</span>
              <span className="ml-1.5 flex items-center">
                <FiCircle className="text-red-500 mr-1 animate-pulse" size={8} />
                {formatTime(currentTime)}
              </span>
            </>
          ) : isPlaying ? (
            <>
              <FiMic className="text-blue-500 mr-1.5" />
              <span>Playing</span>
              <span className="ml-1.5">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </>
          ) : (
            <div className="flex items-center text-gray-500">
              <FiMicOff className="mr-1.5" />
              <span>Ready</span>
            </div>
          )}
        </div>

        {/* Save Status */}
        {currentNote && (
          <div className="flex items-center">
            {hasUnsavedChanges ? (
              <span className="text-yellow-500 flex items-center">
                <FiAlertCircle className="mr-1" size={14} />
                Unsaved changes
              </span>
            ) : (
              <span className="text-green-500 flex items-center">
                <FiSave className="mr-1" size={14} />
                All changes saved
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Word/Character Count */}
        {currentNote && (
          <div className="hidden md:flex items-center space-x-2">
            <span>{wordCount} words</span>
            <span className="text-gray-400">•</span>
            <span>{charCount} characters</span>
          </div>
        )}

        {/* Memory Usage */}
        <div className="hidden md:flex items-center">
          <div className="w-16 bg-gray-700 bg-opacity-30 rounded-full h-1.5 mr-2">
            <div 
              className={`h-full rounded-full ${getMemoryColor(memoryUsage)}`}
              style={{ width: `${Math.min(100, memoryUsage)}%` }}
            />
          </div>
          <span className={`text-xs ${getMemoryColor(memoryUsage)}`}>
            {Math.round(memoryUsage)}%
          </span>
        </div>

        {/* Current Time */}
        <div className="flex items-center">
          <FiClock className="mr-1.5" size={12} />
          <span>{format(currentTimeState, 'h:mm a')}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
