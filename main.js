const { app, BrowserWindow, ipcMain, screen, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const { fork, exec } = require('child_process');

let mainWindow;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  // Adding 40px to width/height to account for 20px padding on all sides for the drop shadow
  const initialWidth = 160;
  const initialHeight = 75;

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: Math.round((width - initialWidth) / 2),
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();

  // Global hotkey to hide/unhide
  globalShortcut.register('Alt+N', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle resize requests from renderer
ipcMain.on('resize-window', (event, newWidth, newHeight) => {
  if (mainWindow) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    
    mainWindow.setBounds({
      width: newWidth,
      height: newHeight,
      x: Math.round((width - newWidth) / 2),
      y: 0
    });
  }
});

// Spawn a standard Node process for SMTC to avoid Electron ABI mismatch crashes
const smtcWorker = fork(path.join(__dirname, 'smtc-worker.js'));

smtcWorker.on('message', (msg) => {
  if (mainWindow && msg.type === 'media-update') {
    mainWindow.webContents.send('media-update', msg.media);
  }
});

// Media IPC handling
ipcMain.on('media-control', (event, action) => {
  if (['playpause', 'next', 'prev'].includes(action)) {
    exec(`powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "${path.join(__dirname, 'media.ps1')}" ${action}`);
  }
});

// App Launching
ipcMain.on('launch-app', (event, appName) => {
  if (appName === 'calc') exec('calc.exe');
  if (appName === 'notepad') exec('notepad.exe');
  if (appName === 'explorer') exec('explorer.exe');
  if (appName === 'chrome' || appName === 'msedge' || appName === 'browser') {
    const { shell } = require('electron');
    shell.openExternal('https://google.com');
  }
});

// File Drag Out
ipcMain.on('drag-file', (event, filePath) => {
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
  event.sender.startDrag({
    file: filePath,
    icon: icon
  });
});

// Volume Control (Loudness is loaded dynamically so it doesn't crash if not installed yet)
ipcMain.on('set-volume', (event, vol) => {
  try {
    const loudness = require('loudness');
    loudness.setVolume(Number(vol)).catch(() => {});
  } catch (e) {}
});
setInterval(async () => {
  if (mainWindow) {
    try {
      const loudness = require('loudness');
      const vol = await loudness.getVolume();
      mainWindow.webContents.send('current-volume', vol);
    } catch(e) {}
  }
}, 2000);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (smtcWorker) smtcWorker.kill();
});
