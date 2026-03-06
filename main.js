const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0e0f11',
      symbolColor: '#e2e4e8',
      height: 40
    },
    backgroundColor: '#080909',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── GET DRIVES ──────────────────────────────────────────
ipcMain.handle('get-drives', async () => {
  const drives = [];

  if (process.platform === 'win32') {
    // Windows: scan drive letters A-Z
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i) + ':\\';
      try {
        const stat = fs.statSync(letter);
        if (stat) {
          const info = await getDriveInfo(letter);
          drives.push({ path: letter, letter: String.fromCharCode(i) + ':', name: info.name, total: info.total, free: info.free, icon: getDriveIcon(letter) });
        }
      } catch {}
    }
  } else if (process.platform === 'darwin') {
    // macOS: /Volumes
    try {
      const vols = fs.readdirSync('/Volumes');
      for (const v of vols) {
        const p = path.join('/Volumes', v);
        try {
          const info = await getDriveInfo(p);
          drives.push({ path: p, letter: v[0].toUpperCase() + ':', name: v, total: info.total, free: info.free, icon: v === 'Macintosh HD' ? '💿' : '💾' });
        } catch {}
      }
    } catch {}
    // always include home
    const home = os.homedir();
    try {
      const info = await getDriveInfo(home);
      drives.push({ path: home, letter: '~', name: 'Home', total: info.total, free: info.free, icon: '🏠' });
    } catch {}
  } else {
    // Linux: common mount points
    const mounts = ['/', '/home', '/media', '/mnt'];
    for (const m of mounts) {
      try {
        fs.accessSync(m);
        const info = await getDriveInfo(m);
        drives.push({ path: m, letter: m === '/' ? '/' : path.basename(m), name: m, total: info.total, free: info.free, icon: m === '/' ? '💿' : '📁' });
      } catch {}
    }
  }

  return drives.length ? drives : getFallbackDrives();
});

function getDriveIcon(letter) {
  const l = letter.toUpperCase();
  if (l === 'C:\\') return '💿';
  if (/^[DE]/.test(l)) return '💾';
  return '🔌';
}

async function getDriveInfo(drivePath) {
  return new Promise((resolve) => {
    try {
      // Try statvfs equivalent via df command
      const { execSync } = require('child_process');
      let cmd;
      if (process.platform === 'win32') {
        cmd = `wmic logicaldisk where "DeviceID='${drivePath.replace('\\','')}'" get Size,FreeSpace /format:value`;
      } else {
        cmd = `df -k "${drivePath}" | tail -1`;
      }

      if (process.platform === 'win32') {
        const out = execSync(cmd, { timeout: 3000 }).toString();
        const freeMatch = out.match(/FreeSpace=(\d+)/);
        const sizeMatch = out.match(/Size=(\d+)/);
        resolve({
          total: sizeMatch ? parseInt(sizeMatch[1]) : 0,
          free: freeMatch ? parseInt(freeMatch[1]) : 0,
          name: drivePath === 'C:\\' ? 'Local Disk' : 'Drive'
        });
      } else {
        const out = execSync(cmd, { timeout: 3000 }).toString().trim();
        const parts = out.split(/\s+/);
        const total = parseInt(parts[1]) * 1024;
        const used = parseInt(parts[2]) * 1024;
        const free = parseInt(parts[3]) * 1024;
        resolve({ total: total || 0, free: free || 0, name: parts[5] || drivePath });
      }
    } catch {
      resolve({ total: 0, free: 0, name: path.basename(drivePath) || drivePath });
    }
  });
}

function getFallbackDrives() {
  const home = os.homedir();
  return [{ path: home, letter: '~', name: 'Home', total: 500e9, free: 150e9, icon: '🏠' }];
}

// ── SCAN DIRECTORY ──────────────────────────────────────
ipcMain.handle('scan-directory', async (event, dirPath) => {
  const results = new Map();
  let totalScanned = 0;
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          const { size, count } = await getDirectorySize(fullPath, event);
          results.set(entry.name, {
            name: entry.name,
            path: fullPath,
            size,
            count,
            isDir: true,
            canDelete: true
          });
          totalSize += size;
          totalScanned += count;
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          results.set(entry.name, {
            name: entry.name,
            path: fullPath,
            size: stat.size,
            count: 1,
            isDir: false,
            canDelete: true
          });
          totalSize += stat.size;
          totalScanned++;
        }

        // Send progress updates
        event.sender.send('scan-progress', {
          files: totalScanned,
          size: totalSize,
          current: entry.name
        });

      } catch (err) {
        // Permission denied etc - skip silently
      }
    }
  } catch (err) {
    console.error('Scan error:', err);
  }

  const data = Array.from(results.values()).sort((a, b) => b.size - a.size);
  return data;
});

async function getDirectorySize(dirPath, event) {
  let size = 0;
  let count = 0;

  function walk(p) {
    try {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const fp = path.join(p, e.name);
        try {
          if (e.isDirectory()) {
            walk(fp);
          } else if (e.isFile()) {
            const stat = fs.statSync(fp);
            size += stat.size;
            count++;
          }
        } catch {}
      }
    } catch {}
  }

  walk(dirPath);
  return { size, count };
}

// ── DELETE ITEMS ────────────────────────────────────────
ipcMain.handle('delete-items', async (event, items) => {
  const results = [];
  let freedSpace = 0;

  for (const item of items) {
    try {
      // Move to trash instead of permanent delete (safer!)
      await shell.trashItem(item.path);
      results.push({ path: item.path, success: true });
      freedSpace += item.size;
    } catch (err) {
      results.push({ path: item.path, success: false, error: err.message });
    }
  }

  return { results, freedSpace };
});

// ── CONFIRM DELETE DIALOG ───────────────────────────────
ipcMain.handle('confirm-delete', async (event, items) => {
  const totalSize = items.reduce((s, i) => s + i.size, 0);
  const names = items.slice(0, 3).map(i => i.name).join(', ');
  const extra = items.length > 3 ? ` and ${items.length - 3} more` : '';

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Move to Trash', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Confirm Delete',
    message: `Move to Trash?`,
    detail: `${names}${extra}\n\nThis will free up ${formatSize(totalSize)}. Items will be moved to your Trash/Recycle Bin.`
  });

  return result.response === 0; // true = confirmed
});

// ── OPEN IN EXPLORER ────────────────────────────────────
ipcMain.handle('show-in-explorer', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── OPEN FOLDER PICKER ──────────────────────────────────
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select a folder to analyze'
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── WINDOW CONTROLS ─────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window-close', () => mainWindow.close());

function formatSize(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return bytes + ' B';
}
