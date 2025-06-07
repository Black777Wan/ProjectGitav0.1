import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AudioPlayer from './AudioPlayer'; // Adjust path

// Mock HTMLAudioElement
describe('AudioPlayer', () => {
  let mockAudioElement: {
    play: jest.Mock;
    pause: jest.Mock;
    load: jest.Mock;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    currentTime: number;
    duration: number;
    muted: boolean;
    readyState: number;
    paused: boolean; // Added to track paused state
  };

  const eventListeners: Record<string, Function> = {};

  beforeEach(() => {
    mockAudioElement = {
      play: jest.fn(() => { // Ensure play returns a Promise
        mockAudioElement.paused = false;
        return Promise.resolve();
      }),
      pause: jest.fn(() => {
        mockAudioElement.paused = true;
      }),
      load: jest.fn(),
      addEventListener: jest.fn((event, listener) => {
        eventListeners[event] = listener;
      }),
      removeEventListener: jest.fn((event) => {
        delete eventListeners[event];
      }),
      currentTime: 0,
      duration: 0, // Will be set in tests
      muted: false,
      readyState: 0, // 0 = HAVE_NOTHING
      paused: true,
    };

    // Spy on createElement and return our mock
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'audio') {
        return mockAudioElement as unknown as HTMLAudioElement;
      }
      return document.createElement(tagName); // Fallback for other elements if any
    });

    // Clear event listeners for each test
    for (const key in eventListeners) {
        delete eventListeners[key];
    }
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Clean up spy
  });

  const simulateAudioEvent = (eventName: string, eventData?: any) => {
    act(() => {
      if (eventListeners[eventName]) {
        eventListeners[eventName](eventData);
      }
    });
  };

  const setupAudioPlayer = (props: Partial<React.ComponentProps<typeof AudioPlayer>> = {}) => {
    const defaultProps: React.ComponentProps<typeof AudioPlayer> = {
      audioSrc: 'test.mp3',
      startTime: 0,
      ...props,
    };
    render(<AudioPlayer {...defaultProps} />);

    // Simulate metadata load to enable controls
    mockAudioElement.duration = props.endTime ? (props.endTime + 5000) / 1000 : 60; // e.g. 60s total duration or endTime + 5s
    mockAudioElement.readyState = 4; // HAVE_ENOUGH_DATA
    simulateAudioEvent('loadedmetadata');
  };


  test('renders initial state correctly (loading, then ready)', () => {
    render(<AudioPlayer audioSrc="test.mp3" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    act(() => {
      mockAudioElement.duration = 60; // 60 seconds
      mockAudioElement.readyState = 4; // HAVE_ENOUGH_DATA
      if (eventListeners.loadedmetadata) eventListeners.loadedmetadata();
    });

    expect(screen.getByText('00:00 / 01:00')).toBeInTheDocument(); // Default start time 0, duration 60s
    expect(screen.getByTitle('Play')).toBeInTheDocument();
  });

  test('plays and pauses audio', async () => {
    setupAudioPlayer();

    const playButton = screen.getByTitle('Play');
    fireEvent.click(playButton);
    expect(mockAudioElement.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTitle('Pause')).toBeInTheDocument());

    const pauseButton = screen.getByTitle('Pause');
    fireEvent.click(pauseButton);
    expect(mockAudioElement.pause).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTitle('Play')).toBeInTheDocument());
  });

  test('handles startTime prop', () => {
    const startTimeMs = 10000; // 10 seconds
    setupAudioPlayer({ startTime: startTimeMs, audioSrc: "test_start.mp3" }); // Change src to trigger effect

    // loadedmetadata will set currentTime based on startTime
    expect(mockAudioElement.currentTime).toBe(startTimeMs / 1000);
    expect(screen.getByText('00:10 / 01:00')).toBeInTheDocument(); // Assuming total duration 60s
  });

  test('handles time updates and stops at endTime', async () => {
    const startTimeMs = 5000; // 5s
    const endTimeMs = 10000; // 10s (segment duration 5s)
    setupAudioPlayer({ startTime: startTimeMs, endTime: endTimeMs, audioSrc: "test_segment.mp3" });

    expect(screen.getByText('00:00 / 00:05')).toBeInTheDocument(); // Display relative to segment

    const playButton = screen.getByTitle('Play');
    fireEvent.click(playButton);
    expect(mockAudioElement.play).toHaveBeenCalled();
    mockAudioElement.paused = false; // Simulate playing

    // Simulate time passing
    act(() => {
      mockAudioElement.currentTime = 7; // Absolute time 7s (2s into segment)
      simulateAudioEvent('timeupdate');
    });
    await waitFor(() => expect(screen.getByText('00:02 / 00:05')).toBeInTheDocument());

    act(() => {
      mockAudioElement.currentTime = 10; // Absolute time 10s (segment end)
      simulateAudioEvent('timeupdate');
    });

    // Should pause at endTime
    await waitFor(() => expect(mockAudioElement.pause).toHaveBeenCalled());
    expect(screen.getByTitle('Play')).toBeInTheDocument(); // Should revert to Play button
    expect(screen.getByText('00:05 / 00:05')).toBeInTheDocument(); // Display current time at segment end
  });

  test('seek bar works within segment boundaries', () => {
    const startTimeMs = 10000; // 10s
    const endTimeMs = 30000; // 30s (segment duration 20s)
    // Set file duration to be longer than segment
    mockAudioElement.duration = 40; // 40s
    setupAudioPlayer({ startTime: startTimeMs, endTime: endTimeMs, audioSrc: "test_seek.mp3" });

    expect(screen.getByText('00:00 / 00:20')).toBeInTheDocument();

    const seekBar = screen.getByRole('slider'); // Input type range

    // Seek to 5s into the segment (absolute time 15s)
    fireEvent.change(seekBar, { target: { value: '5' } }); // value is in seconds for the segment
    expect(mockAudioElement.currentTime).toBe((startTimeMs / 1000) + 5); // 10s + 5s = 15s
    act(() => simulateAudioEvent('timeupdate')); // Trigger UI update
    expect(screen.getByText('00:05 / 00:20')).toBeInTheDocument();

    // Seek to end of segment
    fireEvent.change(seekBar, { target: { value: '20' } }); // 20s (segment end)
    expect(mockAudioElement.currentTime).toBe(endTimeMs / 1000); // 30s
    act(() => simulateAudioEvent('timeupdate'));
    expect(screen.getByText('00:20 / 00:20')).toBeInTheDocument();
  });

  test('skip forward/backward works within segment boundaries', () => {
    const startTimeMs = 5000; // 5s
    const endTimeMs = 25000; // 25s (segment duration 20s)
    mockAudioElement.duration = 30; // 30s total file duration
    setupAudioPlayer({ startTime: startTimeMs, endTime: endTimeMs, audioSrc: "test_skip.mp3" });

    // Initial position: 00:00 of segment (abs: 5s)
    mockAudioElement.currentTime = startTimeMs / 1000;
    act(() => simulateAudioEvent('timeupdate'));
    expect(screen.getByText('00:00 / 00:20')).toBeInTheDocument();

    // Skip forward
    fireEvent.click(screen.getByTitle('Skip forward 5 seconds'));
    expect(mockAudioElement.currentTime).toBe((startTimeMs + 5000) / 1000); // 5s + 5s = 10s
    act(() => simulateAudioEvent('timeupdate'));
    expect(screen.getByText('00:05 / 00:20')).toBeInTheDocument();

    // Skip backward
    fireEvent.click(screen.getByTitle('Skip back 5 seconds'));
    expect(mockAudioElement.currentTime).toBe(startTimeMs / 1000); // Back to 5s (segment start)
    act(() => simulateAudioEvent('timeupdate'));
    expect(screen.getByText('00:00 / 00:20')).toBeInTheDocument();

    // Skip backward should not go before segment start
    fireEvent.click(screen.getByTitle('Skip back 5 seconds'));
    expect(mockAudioElement.currentTime).toBe(startTimeMs / 1000); // Still 5s
    act(() => simulateAudioEvent('timeupdate'));
    expect(screen.getByText('00:00 / 00:20')).toBeInTheDocument();

    // Go near end and skip forward
    mockAudioElement.currentTime = (endTimeMs - 3000) / 1000; // 3s before end of segment (abs: 22s)
    act(() => simulateAudioEvent('timeupdate'));
    expect(screen.getByText('00:17 / 00:20')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Skip forward 5 seconds'));
    expect(mockAudioElement.currentTime).toBe(endTimeMs / 1000); // Should cap at segment end (abs: 25s)
    act(() => simulateAudioEvent('timeupdate'));
    expect(screen.getByText('00:20 / 00:20')).toBeInTheDocument();
  });

  test('restarts segment if play is pressed when at the end of a segment', async () => {
    const startTimeMs = 5000;
    const endTimeMs = 10000;
    setupAudioPlayer({ startTime: startTimeMs, endTime: endTimeMs, audioSrc: "test_restart.mp3" });

    // Manually set current time to endTimeMs (or beyond) and player to paused
    mockAudioElement.currentTime = endTimeMs / 1000;
    mockAudioElement.paused = true;
    act(() => {
        simulateAudioEvent('timeupdate'); // Update UI to reflect this state
    });
    await waitFor(() => expect(screen.getByText('00:05 / 00:05')).toBeInTheDocument()); // At end of segment
    expect(screen.getByTitle('Play')).toBeInTheDocument(); // Should be in a playable state

    fireEvent.click(screen.getByTitle('Play'));

    // Should restart from startTimeMs
    expect(mockAudioElement.currentTime).toBe(startTimeMs / 1000);
    expect(mockAudioElement.play).toHaveBeenCalled();
  });

});
