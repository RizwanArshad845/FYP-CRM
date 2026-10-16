const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App version
  getAppVersion: () => process.env.npm_package_version,

  // Dynamic port
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),

  // Auto-update events
  onUpdateStatus: (callback) =>
    ipcRenderer.on('update-status', (_event, status) => callback(status)),

  // Clean up update listener
  removeUpdateListener: () =>
    ipcRenderer.removeAllListeners('update-status'),
});