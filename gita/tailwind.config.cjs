/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        light: {
          bg: '#F5F5F5',
          sidebar: '#E0E0E0',
          accent: '#1976D2',
          text: '#212121',
          muted: '#757575',
          border: '#BDBDBD',
          hover: '#EEEEEE',
          active: '#D6D6D6',
        },
        obsidian: {
          bg: '#202020',
          sidebar: '#252525',
          accent: '#7F6DF2',
          text: '#DCDDDE',
          muted: '#999999',
          border: '#333333',
          hover: '#303030',
          active: '#383838',
        },
      },
    },
  },
  plugins: [],
}
