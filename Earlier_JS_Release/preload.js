const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Native Cursor Polling Bridge
  setHitbox: (w, h) => ipcRenderer.send('set-hitbox', w, h),
  onHoverEnter: (callback) => ipcRenderer.on('hover-enter', callback),
  onHoverLeave: (callback) => ipcRenderer.on('hover-leave', callback),
  onToggleExpansion: (callback) => ipcRenderer.on('toggle-expansion', callback),
  
  // Media Controls
  onMediaUpdate: (callback) => ipcRenderer.on('media-update', (event, media) => callback(media)),
  mediaControl: (action) => ipcRenderer.send('media-control', action),
  
  // Volume Controls
  setVolume: (vol) => ipcRenderer.send('set-volume', vol),
  getVolume: () => ipcRenderer.send('get-volume'),
  onCurrentVolume: (callback) => ipcRenderer.on('current-volume', (event, vol) => callback(vol)),
  
  // Quick Apps
  launchApp: (appName) => ipcRenderer.send('launch-app', appName),
  
  // Auto Updater
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, version) => callback(version)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, progress) => callback(progress)),
  startUpdate: () => ipcRenderer.send('start-update'),
  
  // Hardcore Background Suspension
  suspendBackground: () => ipcRenderer.send('suspend-background'),
  resumeBackground: () => ipcRenderer.send('resume-background'),

  // Native Clipboard Wrapper
  readClipboard: () => clipboard.readText(),
  writeClipboard: (text) => clipboard.writeText(text)
});
