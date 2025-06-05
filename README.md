# Ananta Notes

A Roam Research-style note-taking application with synchronized audio recording capabilities.

## Features

- **Hierarchical Note-Taking**: Create nested bullet-point outlines with infinite depth
- **Daily Notes**: Automatic daily note pages for journaling
- **Page Linking**: Wiki-style linking between pages using [[Page Name]] syntax
- **Audio Recording**: Record microphone and system audio simultaneously (coming in Phase 2)
- **Audio Sync**: Timestamps linked to notes for playback from specific moments (coming in Phase 2)
- **Modern UI**: Clean, minimalistic design inspired by modern productivity apps

## Prerequisites

Before running the application, make sure you have:

1. **Node.js** (version 16 or higher)
2. **PostgreSQL** (version 12 or higher)
3. **npm** or **yarn** package manager

## Database Setup

1. Install PostgreSQL if you haven't already
2. Create a new database:
   ```sql
   CREATE DATABASE ananta_notes;
   ```
3. Update the database connection settings in `src/main/database.js` if needed

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd YD-Notes
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your PostgreSQL credentials

## Running the Application

### Development Mode

To run the application in development mode:

```bash
npm start
```

This will:
- Start the React development server on `http://localhost:3000`
- Launch the Electron application
- Enable hot reloading for both React and Electron

### Building for Production

To build the application for production:

```bash
npm run build
npm run build:electron
```

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── main.js        # Main Electron process
│   ├── preload.js     # Preload script for secure IPC
│   └── database.js    # PostgreSQL database manager
├── components/        # React components
│   ├── Editor.js      # TipTap rich text editor
│   ├── Sidebar.js     # Navigation sidebar
│   └── PageHeader.js  # Page title and metadata
├── hooks/             # Custom React hooks
│   └── usePages.js    # Page management logic
├── styles/            # Styled components and global styles
│   └── GlobalStyles.js
├── App.js             # Main React application
└── index.js           # React entry point
```

## Technology Stack

- **Frontend**: React 18, Styled Components, TipTap Editor
- **Backend**: Electron, Node.js
- **Database**: PostgreSQL
- **Build Tools**: Electron Builder, React Scripts

## Development Phases

### Phase 1: Core Note-Taking MVP ✅
- [x] Project setup with Electron + React
- [x] PostgreSQL database integration
- [x] Outliner editor with bullet points
- [x] Page management and navigation
- [x] Daily notes functionality
- [x] Basic page linking support

### Phase 2: Audio Integration (Upcoming)
- [ ] Dual audio recording (mic + system)
- [ ] Audio-note synchronization
- [ ] Timestamp-based playback
- [ ] Audio storage and management

### Phase 3: Advanced Features (Future)
- [ ] Block references and transclusion
- [ ] Backlinks and graph view
- [ ] Search functionality
- [ ] Export/import capabilities

## Contributing

This is a personal project, but contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the MIT License.
