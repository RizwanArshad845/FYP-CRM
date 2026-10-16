import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── CHROMIUM FLAGS: Focus & Rendering Stability ─────────────────────────────
// We'll keep these flags but re-enable HW acceleration to ensure the custom 
// taskbar icon and native window elements render correctly.
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService,CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-gpu-rasterization');


let mainWindow = null;

// ── IPC HANDLERS ──────────────────────────────────────────────────────────────
ipcMain.handle('get-backend-port', () => null);

// ── AUTO-UPDATER ──────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', 'downloading');
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', 'ready');
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err?.message);
  });

  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}

function createWindow() {
  let iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  if (!app.isPackaged) {
    iconPath = path.join(__dirname, '..', 'public', 'branding', 'logo_n.png');
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'NexusWave CRM',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
    show: false, // Don't show until ready
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    const tryLoad = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) tryLoad();
        }, 1000);
      });
    };
    tryLoad();
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ── No more aggressive polling or snapping — causes glitches ───────────────

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── APP LIFECYCLE ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    const isDev = !app.isPackaged;
    app.setAppUserModelId(isDev ? 'com.crm.desktop.dev' : 'com.crm.desktop');
  }
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    setTimeout(() => process.exit(0), 500);
  }
});