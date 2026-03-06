# 🗂 DiskMap — Disk Space Analyzer

A beautiful, modern disk space analyzer built with Electron. Scan drives, visualize storage usage, and delete files directly from the app.

## ✨ Features

- **Beautiful welcome screen** — fades in on launch, shows your real drives
- **Real disk scanning** — scans actual files and folders on your computer
- **Treemap & List views** — visual or detailed breakdown
- **Select & Delete** — tick items and move them to Trash with one click
- **Switch drives** — jump between drives anytime from the toolbar
- **Safe deletes** — items go to Trash/Recycle Bin, not permanently deleted

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or newer)

### Install & Run

```bash
# 1. Go into the diskmap folder
cd diskmap

# 2. Install dependencies
npm install

# 3. Launch the app
npm start
```

That's it! The app will open on your screen.

## 📦 Build a distributable

```bash
# Build for your current platform
npm run dist
```

This creates an installer in the `dist/` folder:
- **Windows** → `.exe` installer (NSIS)
- **macOS** → `.dmg`
- **Linux** → `.AppImage`

## 🗑 How deleting works

When you delete items, they're moved to your system **Trash / Recycle Bin** — NOT permanently deleted. You can always restore them from there if you change your mind.

## 🔒 Permissions

On **macOS**, the app may ask for Full Disk Access to scan protected folders. Go to **System Settings → Privacy & Security → Full Disk Access** and add DiskMap.

On **Windows**, run as Administrator to scan protected system folders.
