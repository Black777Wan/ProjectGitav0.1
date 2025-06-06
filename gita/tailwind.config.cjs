/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian-like color palette
        'obsidian-bg': '#202020',
        'obsidian-sidebar': '#252525',
        'obsidian-accent': '#7F6DF2',
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

