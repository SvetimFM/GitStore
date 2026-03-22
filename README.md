<div align="center">

# GitStore

**App Store for GitHub**

[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20NC%201.0-blue.svg)](./LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)]()
[![Version: 0.1.0](https://img.shields.io/badge/version-0.1.0-green.svg)]()

Discover, install, and run GitHub repositories as native applications.

<!-- ![GitStore Screenshot](docs/screenshot.png) -->

</div>

---

## ✨ Features

- **Curated Collections** — Browse hand-picked app categories: dev tools, AI agents, productivity, and more
- **One-Click Install** — Clone, set up dependencies, and configure any repo with a single click
- **5 Built-in Runtimes** — Node.js, Python, Rust, Go, and Docker — detected and managed automatically
- **Trending Discovery** — See what's popular on GitHub right now, filtered by language and timeframe
- **Desktop App** — Native macOS app built with Tauri — fast, lightweight, and private
- **MCP Integration** — Use GitStore as an MCP server to let AI assistants install and manage repos

## 🚀 Quick Start

### Download

Grab the latest `.dmg` from [Releases](https://github.com/SvetimFM/GitStore/releases/latest).

### Run from Source

```bash
git clone https://github.com/SvetimFM/GitStore.git
cd gitstore
npm install
npm run build
npm start
```

## 🔧 How It Works

1. **Discover** — Browse curated lists or search GitHub for repositories
2. **Inspect** — View README, stars, language, and install requirements before committing
3. **Install** — GitStore clones the repo, detects the runtime, and installs dependencies
4. **Run** — Launch the app directly from GitStore with the correct runtime environment

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | [Tauri](https://tauri.app) + Rust |
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + SQLite |
| AI | MCP Server (Model Context Protocol) |

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
# Development
npm run dev        # Watch backend
npm run dev:web    # Vite dev server for frontend

# Build
npm run build      # Full build (backend + frontend)
```

## 📄 License

[PolyForm Noncommercial 1.0.0](./LICENSE) — free for personal and noncommercial use.
