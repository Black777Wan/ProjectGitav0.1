/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Added for class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-light-bg',
    'dark:bg-obsidian-bg',
    'text-light-text',
    'dark:text-obsidian-text',
    'bg-light-border',
    'dark:bg-obsidian-border',
    'hover:bg-light-muted',
    'dark:hover:bg-obsidian-muted',
    'ring-light-accent',
    'dark:ring-obsidian-accent',
  ],
  theme: {
    extend: {
      colors: {
        // Light theme
        'light-bg': '#F5F5F5',
        'light-sidebar': '#E0E0E0',
        'light-accent': '#1976D2', // Example blue accent for light theme
        'light-text': '#212121',
        'light-muted': '#757575',
        'light-border': '#BDBDBD',
        'light-hover': '#EEEEEE',
        'light-active': '#D6D6D6', // Slightly darker than hover

        // Obsidian-like dark theme (prefixed for clarity, or use directly if not ambiguous)
        // For Tailwind JIT to work with dark: prefix, we define base colors
        // and then expect to use them like: bg-light-bg dark:bg-dark-bg
        // So, we'll define a 'dark' object or ensure color names are distinct.
        // Let's try to make current obsidian colors the "dark" variant by default.
        // We will need to update components to use non-prefixed names,
        // e.g. bg-bg instead of bg-obsidian-bg.
        // And then index.css will apply dark:bg-obsidian-bg etc.
        // This seems more complex than needed.

        // Alternative: Define colors such that they are the *light* mode defaults,
        // and dark mode overrides them.
        // Example: 'bg': '#F5F5F5' (light-bg), and then dark variant is 'obsidian-bg'
        // This requires components to use generic names like 'bg', 'text', 'accent'.

        // Simplest for now: Keep obsidian as is, and use light- as prefix for light theme.
        // Components will need to be updated to use e.g. `bg-light-bg dark:bg-obsidian-bg`.
        // This is explicit and matches the request.

        'obsidian-bg': '#202020',
        'obsidian-sidebar': '#252525',
        'obsidian-accent': '#7F6DF2', // Purple accent for dark theme
        'obsidian-text': '#DCDDDE',
        'obsidian-muted': '#999999',
        'obsidian-border': '#333333',
        'obsidian-hover': '#303030',
        'obsidian-active': '#383838',
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        'sidebar': '250px',
      },
      boxShadow: {
        'obsidian': '0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.2s ease-in-out',
        'slideIn': 'slideIn 0.3s ease-in-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
