import React, { useState, useEffect } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Initialize theme from local storage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  // Apply theme changes
  useEffect(() => {
    // In a real implementation, this would update CSS variables or class names
    // For now, we'll just save the preference
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // This is a placeholder for actual theme switching logic
    console.log(`Theme switched to ${isDarkMode ? 'dark' : 'light'} mode`);
    
    // In a full implementation, we would update the document class or CSS variables
    // document.documentElement.classList.toggle('dark-theme', isDarkMode);
    // document.documentElement.classList.toggle('light-theme', !isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-full hover:bg-obsidian-hover transition-colors duration-200 ${className}`}
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDarkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
    </button>
  );
};

export default ThemeToggle;

