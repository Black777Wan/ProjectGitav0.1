# Obsidian Replica with Audio Recording

A modern note-taking application with markdown support and audio recording capabilities, built with Tauri, React, TypeScript, and Rust.

## Features

- 📝 Rich markdown editor with Lexical
- 🎤 Audio recording with system and microphone input
- 🔗 Page and block hierarchies
- 🔍 Backlinks and block references
- 📅 Daily notes
- 💾 Local markdown file storage
- 🎧 Audio playback with timestamp synchronization
- 🎨 Clean, modern UI similar to Obsidian

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Editor**: Lexical
- **Desktop**: Tauri
- **Audio**: CPAL (Rust) for recording, HTML5 Audio for playback
- **State Management**: Zustand
- **Markdown**: remark, rehype, unified
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js (v18+)
- Rust (latest stable)
- pnpm (recommended) or npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   cd src-tauri
   cargo install tauri-cli
   ```

### Development

```bash
# Start the development server
pnpm tauri dev
```

### Building

```bash
# Create a production build
pnpm tauri build
```

## Project Structure

```
obsidian-replica/
├── src/
│   ├── components/     # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions and libraries
│   ├── pages/          # Page components
│   ├── stores/         # State management
│   ├── styles/         # Global styles and Tailwind config
│   └── types/          # TypeScript type definitions
├── public/             # Static assets
└── src-tauri/          # Tauri backend code
    ├── src/
    │   ├── audio/     # Audio recording and processing
    │   ├── fs/        # File system operations
    │   └── lib.rs     # Main Rust entry point
    └── Cargo.toml     # Rust dependencies
```

## License

MIT
