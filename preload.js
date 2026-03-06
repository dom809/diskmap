const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diskmap', {
  // Drives
  getDrives: () => ipcRenderer.invoke('get-drives'),

  // Scanning
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  onScanProgress: (cb) => {
    ipcRenderer.on('scan-progress', (event, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('scan-progress');
  },

  // File operations
  deleteItems: (items) => ipcRenderer.invoke('delete-items', items),
  confirmDelete: (items) => ipcRenderer.invoke('confirm-delete', items),
  showInExplorer: (filePath) => ipcRenderer.invoke('show-in-explorer', filePath),

  // Folder picker
  pickFolder: () => ipcRenderer.invoke('pick-folder'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close:    () => ipcRenderer.invoke('window-close'),

  // Platform info
  platform: process.platform
});
