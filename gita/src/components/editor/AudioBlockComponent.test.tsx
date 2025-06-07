import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AudioBlockComponent from './AudioBlockComponent'; // Adjust path
import * as TauriApiCore from '@tauri-apps/api/core';

// Mock child AudioPlayer component
jest.mock('../AudioPlayer', () => jest.fn(({ audioSrc, startTime, endTime }) => (
  <div data-testid="audio-player-mock">
    <span>AudioSrc: {audioSrc}</span>
    <span>StartTime: {startTime}</span>
    <span>EndTime: {endTime === undefined ? 'undefined' : endTime}</span>
  </div>
)));

// Mock tauri's convertFileSrc
jest.mock('@tauri-apps/api/core', () => ({
  ...jest.requireActual('@tauri-apps/api/core'), // Import and retain default behavior
  convertFileSrc: jest.fn(),
}));


describe('AudioBlockComponent', () => {
  const mockProps = {
    blockId: 'block-123',
    recordingId: 'rec-456',
    audioFilePath: '/path/to/audio.wav',
    startTime: 1000, // 1 second
  };

  const convertedSrc = 'converted:/path/to/audio.wav';

  beforeEach(() => {
    (TauriApiCore.convertFileSrc as jest.Mock).mockReturnValue(convertedSrc);
    // Clear mock usage for AudioPlayer
    (require('../AudioPlayer') as jest.Mock).mockClear();
  });

  test('renders loading state initially then play button', async () => {
    render(<AudioBlockComponent {...mockProps} />);
    expect(screen.getByTitle('Loading audio...').querySelector('svg')).toBeInTheDocument(); // FiLoader

    await waitFor(() => {
      expect(screen.getByTitle('Play audio from 00:01')).toBeInTheDocument(); // FiPlay
      expect(screen.queryByTitle('Loading audio...')).not.toBeInTheDocument();
    });
  });

  test('renders error state if audioFilePath is missing', async () => {
    render(<AudioBlockComponent {...mockProps} audioFilePath="" />);
    // No loading state if path is immediately known to be empty
    await waitFor(() => {
        expect(screen.getByTitle('Audio path missing').querySelector('svg')).toBeInTheDocument(); // FiAlertTriangle
    });
  });

  test('renders error state if convertFileSrc throws', async () => {
    (TauriApiCore.convertFileSrc as jest.Mock).mockImplementation(() => {
      throw new Error('Conversion failed');
    });
    render(<AudioBlockComponent {...mockProps} />);
    await waitFor(() => {
      expect(screen.getByTitle('Failed to load audio source. File path may be invalid or inaccessible.').querySelector('svg')).toBeInTheDocument();
    });
  });

  test('clicking play button toggles AudioPlayer visibility and passes correct props', async () => {
    render(<AudioBlockComponent {...mockProps} />);

    await waitFor(() => screen.getByTitle('Play audio from 00:01'));
    const playButton = screen.getByTitle('Play audio from 00:01');

    // Player should not be visible initially
    expect(screen.queryByTestId('audio-player-mock')).not.toBeInTheDocument();

    fireEvent.click(playButton);

    // Player should be visible
    await waitFor(() => {
      expect(screen.getByTestId('audio-player-mock')).toBeInTheDocument();
    });

    const AudioPlayerMock = require('../AudioPlayer') as jest.Mock;
    expect(AudioPlayerMock).toHaveBeenCalledTimes(1);
    const expectedEndTime = mockProps.startTime + 10000; // Simulated 10s segment
    expect(AudioPlayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audioSrc: convertedSrc,
        startTime: mockProps.startTime,
        endTime: expectedEndTime,
      }),
      {} // Second argument to functional component (context)
    );

    // Check content of mock (alternative to checking props if direct prop checking is hard)
    expect(screen.getByText(`AudioSrc: ${convertedSrc}`)).toBeInTheDocument();
    expect(screen.getByText(`StartTime: ${mockProps.startTime}`)).toBeInTheDocument();
    expect(screen.getByText(`EndTime: ${expectedEndTime}`)).toBeInTheDocument();

    // Click again to hide
    fireEvent.click(playButton);
    await waitFor(() => {
      expect(screen.queryByTestId('audio-player-mock')).not.toBeInTheDocument();
    });
  });

  test('useEffect simulates fetching endTime correctly', async () => {
    // This test relies on the mock AudioPlayer rendering the endTime prop
    render(<AudioBlockComponent {...mockProps} startTime={5000} />);

    await waitFor(() => screen.getByTitle('Play audio from 00:05'));
    fireEvent.click(screen.getByTitle('Play audio from 00:05'));

    await waitFor(() => {
      expect(screen.getByTestId('audio-player-mock')).toBeInTheDocument();
    });

    const expectedEndTime = 5000 + 10000; // startTime + 10s
    expect(screen.getByText(`EndTime: ${expectedEndTime}`)).toBeInTheDocument();
  });

   test('useEffect for click outside to close player', async () => {
    render(<AudioBlockComponent {...mockProps} />);
    await waitFor(() => screen.getByTitle('Play audio from 00:01'));
    const playButton = screen.getByTitle('Play audio from 00:01');

    // Open the player
    fireEvent.click(playButton);
    await waitFor(() => expect(screen.getByTestId('audio-player-mock')).toBeInTheDocument());

    // Click outside (on the document body)
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByTestId('audio-player-mock')).not.toBeInTheDocument());
  });


});
