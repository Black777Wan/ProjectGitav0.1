# Contributing to Obsidian Replica

Thank you for considering contributing to Obsidian Replica! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with the following information:

- A clear, descriptive title
- A detailed description of the bug
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment information (OS, browser, etc.)

### Suggesting Features

If you have an idea for a new feature, please create an issue with the following information:

- A clear, descriptive title
- A detailed description of the feature
- Why this feature would be useful
- Any implementation ideas you have

### Pull Requests

1. Fork the repository
2. Create a new branch for your changes
3. Make your changes
4. Write tests for your changes (if applicable)
5. Run the existing tests to ensure they pass
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js (v16 or later)
- Rust (latest stable)
- Tauri development dependencies (see [Tauri setup guide](https://tauri.app/v1/guides/getting-started/prerequisites))

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/obsidian-replica.git
   cd obsidian-replica
   ```

2. Install dependencies:
   ```bash
   cd obsidian-replica
   npm install
   ```

3. Run the development server:
   ```bash
   npm run tauri dev
   ```

## Coding Standards

### Frontend (React/TypeScript)

- Follow the [React Hooks guidelines](https://reactjs.org/docs/hooks-rules.html)
- Use TypeScript for type safety
- Use functional components with hooks
- Follow the existing project structure
- Use Tailwind CSS for styling

### Backend (Rust)

- Follow the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use the Rust formatter (`rustfmt`)
- Write documentation for public functions and modules
- Follow the existing project structure

## Testing

- Write tests for new features
- Ensure existing tests pass
- Test on multiple platforms if possible

## Documentation

- Update documentation for any changes you make
- Document new features
- Keep the README up to date

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

