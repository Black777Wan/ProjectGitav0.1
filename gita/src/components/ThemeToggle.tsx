import React, { useState, useEffect } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  /**
   * Initializes the `isDarkMode` state.
   * Priority:
   * 1. Value from `localStorage` (if previously set by the user).
   * 2. System preference (`prefers-color-scheme`).
   */
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // If no theme is saved in localStorage, use the system preference.
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  /**
   * Effect to apply theme changes to the application.
   * When `isDarkMode` changes:
   * 1. Adds or removes the 'dark' class from the `<html>` element (`document.documentElement`).
   *    This class is used by Tailwind CSS for dark mode styling (`darkMode: 'class'`).
   * 2. Saves the current theme preference to `localStorage`.
   */
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <button
      onClick={toggleTheme}
      // Update button styling to be theme-aware
      className={`p-2 rounded-full hover:bg-light-hover dark:hover:bg-obsidian-hover transition-colors duration-200 ${className}`}
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDarkMode ? <FiSun size={18} className="text-obsidian-text" /> : <FiMoon size={18} className="text-light-text" />}
    </button>
  );
};

export default ThemeToggle;

