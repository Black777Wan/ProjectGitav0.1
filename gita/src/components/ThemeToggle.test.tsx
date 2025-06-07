import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from './ThemeToggle'; // Adjust path as necessary

describe('ThemeToggle', () => {
  let store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    removeItem: jest.fn((key: string) => delete store[key]),
  };

  let mockMatchMediaMatches = true; // Default to system prefers dark

  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)' ? mockMatchMediaMatches : false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    // Reset localStorage store and mockMatchMediaMatches before each test
    store = {};
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.getItem.mockClear();
    document.documentElement.classList.remove('dark'); // Ensure clean slate
    mockMatchMediaMatches = true; // Default to system prefers dark for each test run unless overridden
  });

  test('initial render: respects system preference for dark mode if no localStorage value', () => {
    mockMatchMediaMatches = true; // System prefers dark
    render(<ThemeToggle />);
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByTitle('Switch to Light Mode')).toBeInTheDocument(); // Sun icon means dark mode is active
  });

  test('initial render: respects system preference for light mode if no localStorage value', () => {
    mockMatchMediaMatches = false; // System prefers light
    render(<ThemeToggle />);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByTitle('Switch to Dark Mode')).toBeInTheDocument(); // Moon icon means light mode is active
  });

  test('initial render: respects localStorage value "dark" if set', () => {
    store['theme'] = 'dark';
    render(<ThemeToggle />);
    expect(document.documentElement).toHaveClass('dark');
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('theme');
    expect(screen.getByTitle('Switch to Light Mode')).toBeInTheDocument();
  });

  test('initial render: respects localStorage value "light" if set', () => {
    store['theme'] = 'light';
    render(<ThemeToggle />);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('theme');
    expect(screen.getByTitle('Switch to Dark Mode')).toBeInTheDocument();
  });

  test('button click: toggles theme from light to dark', () => {
    store['theme'] = 'light'; // Start in light mode
    mockMatchMediaMatches = false; // System prefers light, to ensure toggle is based on current state
    render(<ThemeToggle />);

    const toggleButton = screen.getByRole('button');
    expect(document.documentElement).not.toHaveClass('dark'); // Pre-condition: light mode

    fireEvent.click(toggleButton);

    expect(document.documentElement).toHaveClass('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(screen.getByTitle('Switch to Light Mode')).toBeInTheDocument(); // Sun icon visible
  });

  test('button click: toggles theme from dark to light', () => {
    store['theme'] = 'dark'; // Start in dark mode
    mockMatchMediaMatches = true; // System prefers dark
    render(<ThemeToggle />);

    const toggleButton = screen.getByRole('button');
    expect(document.documentElement).toHaveClass('dark'); // Pre-condition: dark mode

    fireEvent.click(toggleButton);

    expect(document.documentElement).not.toHaveClass('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(screen.getByTitle('Switch to Dark Mode')).toBeInTheDocument(); // Moon icon visible
  });

  test('button click: toggles theme from system dark to light', () => {
    // No localStorage, system prefers dark
    mockMatchMediaMatches = true;
    render(<ThemeToggle />);

    const toggleButton = screen.getByRole('button');
    expect(document.documentElement).toHaveClass('dark'); // Pre-condition: dark mode (from system)

    fireEvent.click(toggleButton);

    expect(document.documentElement).not.toHaveClass('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(screen.getByTitle('Switch to Dark Mode')).toBeInTheDocument();
  });

  test('button click: toggles theme from system light to dark', () => {
    // No localStorage, system prefers light
    mockMatchMediaMatches = false;
    render(<ThemeToggle />);

    const toggleButton = screen.getByRole('button');
    expect(document.documentElement).not.toHaveClass('dark'); // Pre-condition: light mode (from system)

    fireEvent.click(toggleButton);

    expect(document.documentElement).toHaveClass('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(screen.getByTitle('Switch to Light Mode')).toBeInTheDocument();
  });
});
