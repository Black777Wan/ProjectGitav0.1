/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian-like dark theme colors
        'bg-primary': '#202020',
        'bg-secondary': '#252525',
        'text-normal': '#dcddde',
        'text-muted': '#a0a0a0',
        'text-accent': '#7f9cf5',
        'interactive-normal': '#c8c8c8',
        'interactive-hover': '#ffffff',
        'interactive-accent': '#7f9cf5',
        'interactive-accent-hover': '#8da5f3',
      },
    },
  },
  plugins: [],
}
