require('v8-compile-cache');
const { app, BrowserWindow, ipcMain, screen, globalShortcut, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const { fork, exec, spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const os = require('os');

// Hardcore Chromium Engine Optimizations to save RAM and CPU
app.commandLine.appendSwitch('disable-site-isolation-trials'); // Kills the heavy security vault
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,CalculateNativeWinOcclusion'); // Stops keyboard fighting and kills the heavy Windows DWM occlusion math
app.commandLine.appendSwitch('disable-metrics'); // Kills background tracking
app.commandLine.appendSwitch('disable-crash-reporter'); // Kills crash tracking
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=64'); // Forces aggressive memory cleanup and manual sweeps

// Force ultra-aggressive GPU hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization'); // Forces GPU to draw all pixels
app.commandLine.appendSwitch('enable-zero-copy'); // Bypasses CPU memory when sending frames to the GPU
app.commandLine.appendSwitch('disable-software-rasterizer'); // Physically blocks the CPU from attempting to draw UI

let mainWindow;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  // Lock window to the maximum expanded size to physically prevent DWM clipping!
  const initialWidth = 520;
  const initialHeight = 240;

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
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: true
    }
  });

  mainWindow.loadFile('index.html');
  
  // Set window to ignore clicks by default
  mainWindow.setIgnoreMouseEvents(true);

  // Hardcore Native Cursor Polling Engine (Bypasses UIPI & DWM)
  let hitbox = { w: 120, h: 35 };
  let isMouseOver = false;
  
  ipcMain.on('set-hitbox', (event, w, h) => { hitbox = { w, h }; });

  let mousePollInterval = null;
  
  // Cache the screen width so we don't query the Windows Display Driver 40 times a second!
  let cachedScreenWidth = screen.getPrimaryDisplay().workAreaSize.width;
  screen.on('display-metrics-changed', () => {
    cachedScreenWidth = screen.getPrimaryDisplay().workAreaSize.width;
  });
  
  const pollLogic = () => {
    if (!mainWindow) return;
    const point = screen.getCursorScreenPoint();
    
    const islandX = (cachedScreenWidth - hitbox.w) / 2;
    const islandY = 20;
    
    const isInside = (
      point.y >= islandY - 5 && 
      point.y <= islandY + hitbox.h + 5 && 
      point.x >= islandX - 5 && 
      point.x <= islandX + hitbox.w + 5
    );
    
    if (isInside && !isMouseOver) {
      isMouseOver = true;
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.webContents.send('hover-enter');
      
      // DYNAMIC CPU UNDERVOLTING: Drop native C++ polling to 4 FPS!
      clearInterval(mousePollInterval);
      mousePollInterval = setInterval(pollLogic, 250);
      
    } else if (!isInside && isMouseOver) {
      isMouseOver = false;
      mainWindow.setIgnoreMouseEvents(true);
      mainWindow.webContents.send('hover-leave');
      
      // BOOST: Jump back to 40 FPS to catch fast mouse movements over the tiny island
      clearInterval(mousePollInterval);
      mousePollInterval = setInterval(pollLogic, 25);
    }
  };

  const startMousePolling = () => {
    if (mousePollInterval) return;
    mousePollInterval = setInterval(pollLogic, 25);
  };

  const stopMousePolling = () => {
    if (mousePollInterval) {
      clearInterval(mousePollInterval);
      mousePollInterval = null;
    }
  };

  startMousePolling();

  // OS-Level Battery Optimization: Kill the mouse polling loop if the screen locks or PC sleeps
  powerMonitor.on('suspend', stopMousePolling);
  powerMonitor.on('lock-screen', stopMousePolling);
  powerMonitor.on('resume', startMousePolling);
  powerMonitor.on('unlock-screen', startMousePolling);

  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  // Tell Windows to launch this app the second the PC turns on
  const isPackaged = __dirname.includes('app.asar') || process.execPath.toLowerCase().includes('notchnookclone.exe');
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: isPackaged ? [] : [__dirname]
  });

  createWindow();

  // Background Loop Optimization (Suspends when PC is asleep)
  let updaterInterval;
  const startUpdater = () => {
    if (updaterInterval) clearInterval(updaterInterval);
    checkForUpdates();
    updaterInterval = setInterval(checkForUpdates, 3600000);
  };
  const stopUpdater = () => {
    if (updaterInterval) clearInterval(updaterInterval);
  };

  setTimeout(startUpdater, 5000);

  powerMonitor.on('suspend', () => {
    stopUpdater();
    if (smtcWorker) smtcWorker.send('suspend');
  });
  powerMonitor.on('resume', () => {
    startUpdater();
    if (smtcWorker) smtcWorker.send('resume');
  });
  
  // V8 Garbage Collector forced sweep every 30 mins to ensure 0 memory leaks
  setInterval(() => { if (global.gc) global.gc(); }, 30 * 60 * 1000);

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

  // Global hotkey to FORCE QUIT the app completely
  globalShortcut.register('Alt+Shift+Q', () => {
    app.quit();
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Legacy resize-window removed in favor of static bounds + native polling.

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

ipcMain.on('get-volume', async (event) => {
  try {
    const loudness = require('loudness');
    const vol = await loudness.getVolume();
    event.sender.send('current-volume', vol);
  } catch(e) {}
});

// Hardcore Suspension Hooks
ipcMain.on('suspend-background', () => {
  if (smtcWorker) smtcWorker.send('suspend');
});
ipcMain.on('resume-background', () => {
  if (smtcWorker) smtcWorker.send('resume');
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (smtcWorker) smtcWorker.kill();
});

// --- AUTO-UPDATER LOGIC ---
let updateDownloadUrl = null;

function checkForUpdates() {
  const currentVersion = require('./package.json').version;
  const options = {
    hostname: 'api.github.com',
    path: '/repos/PulkitxAG/NotchNook-Windows/releases/latest',
    headers: { 'User-Agent': 'NotchNook-Updater' },
    timeout: 10000
  };
  https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        if (!release || !release.tag_name) return;
        const latestVersion = release.tag_name.replace('v', '');
        
        // Simple semantic version compare
        if (latestVersion > currentVersion && release.assets && release.assets.length > 0) {
          const asset = release.assets.find(a => a.name.endsWith('.zip'));
          if (asset) {
            updateDownloadUrl = asset.browser_download_url;
            if (mainWindow) mainWindow.webContents.send('update-available', latestVersion);
          }
        }
      } catch (e) {}
    });
  }).on('error', () => {}).on('timeout', function() { this.destroy(); });
}

ipcMain.on('start-update', () => {
  if (!updateDownloadUrl) return;
  
  const tempZip = path.join(os.tmpdir(), 'NotchNookUpdate.zip');
  const file = fs.createWriteStream(tempZip);
  
  function download(url) {
    https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location);
      }
      const totalBytes = parseInt(res.headers['content-length'], 10);
      let downloadedBytes = 0;
      
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (mainWindow) {
          mainWindow.webContents.send('update-progress', Math.round((downloadedBytes / totalBytes) * 100));
        }
      });
      
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          // If we are running un-packaged via "npm start", process.execPath is just electron.exe.
          // To be perfectly safe, we'll only trigger the patch script if the app is packaged.
          const isPackaged = __dirname.includes('app.asar') || process.execPath.toLowerCase().includes('notchnookclone.exe');
          
          if (isPackaged) {
            const appDir = path.dirname(process.execPath);
            const exePath = process.execPath;
            const scriptPath = path.join(__dirname, 'updater.ps1');
            
            const ps = spawn('powershell.exe', [
              '-ExecutionPolicy', 'Bypass',
              '-WindowStyle', 'Hidden',
              '-File', `"${scriptPath}"`,
              '-ZipPath', `"${tempZip}"`,
              '-AppDir', `"${appDir}"`,
              '-ExePath', `"${exePath}"`
            ], {
              detached: true,
              stdio: 'ignore'
            });
            ps.unref();
            app.quit();
          } else {
             // Just simulating for dev mode
             if (mainWindow) mainWindow.webContents.send('update-progress', 'DEV_MOCK_SUCCESS');
             // Simulate the restart by physically quitting the dev app after 2 seconds
             setTimeout(() => app.quit(), 2000);
          }
        });
      });
    }).on('error', () => { fs.unlink(tempZip, () => {}); }).on('timeout', function() { this.destroy(); });
  }
  download(updateDownloadUrl);
});
