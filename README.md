# YD-Notes-CPP

A Roam Research/Obsidian-inspired note-taking application built with C++ and Qt.

## Features

- Markdown-based note editor with syntax highlighting
- Bullet lists with proper indentation
- Wiki-style links between notes
- Fast note search
- Clean, modern UI

## Building the Project

### Prerequisites

- Qt 6.x (Qt 5.15+ should also work)
- CMake 3.15+
- C++17 compatible compiler

### Build Instructions

```bash
# Clone the repository
git clone https://github.com/yourusername/YD-Notes-CPP.git
cd YD-Notes-CPP

# Create build directory
mkdir build
cd build

# Configure and build
cmake ..
cmake --build .
```

## Project Structure

- `src/` - Source code
  - `editor/` - Markdown editor components
  - `models/` - Data models for notes
  - `widgets/` - UI components
- `resources/` - Application resources (stylesheets, icons)

## Planned Features

- Graph view of note connections
- Drag and drop for blocks
- LaTeX support
- Image embedding
- Tag system
- Plugin architecture
- Mobile support

## License

MIT License
