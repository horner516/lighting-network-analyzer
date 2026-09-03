const { app, BrowserWindow, Menu, shell, Tray, nativeImage, autoUpdater, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const PORT = Number(process.env.NETWORK_ANALYZER_PORT || 47652);
const HOST = process.env.NETWORK_ANALYZER_HOST || '0.0.0.0';
const SERVER_URL = `http://localhost:${PORT}`;

const APP_ORIGIN = SERVER_URL;
const SERVER_START_DELAY_MS = 1000;
const UPDATER_POLL_MS = 30 * 60 * 1000;

const iconPath = join(__dirname, '..', 'public', process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png');
let mainWindow = null;
let tray = null;
let serverProcess = null;

function createMenu(updateState) {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => mainWindow?.show(),
    },
    {
      label: 'Open in Browser',
      click: () => {
        void shell.openExternal(APP_ORIGIN);
      },
    },
    {
      label: `Check for updates ${updateState || ''}`.trim(),
      click: () => {
        try {
          autoUpdater.checkForUpdates();
        } catch (error) {
          void dialog.showErrorBox('Update check failed', String(error.message ?? error));
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
}

async function waitForServer() {
  for (let i = 0; i < 20; i += 1) {
    try {
      const response = await fetch(`${APP_ORIGIN}/`);
      if (response.ok) return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, SERVER_START_DELAY_MS));
    }
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 920,
    icon: iconPath,
    minWidth: 1100,
    minHeight: 760,
    webPreferences: { nodeIntegration: false },
  });

  mainWindow.setTitle(`Lighting Network Analyzer v${app.getVersion()}`);
  mainWindow.loadURL(APP_ORIGIN);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const trayIcon = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : undefined;
  tray = new Tray(trayIcon || nativeImage.createEmpty());
  tray.setToolTip('Lighting Network Analyzer');
  createMenu();
  tray.on('double-click', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
}

function spawnServer() {
  const startScript = join(__dirname, '..', 'scripts', 'start-lan.mjs');
  const child = spawn(process.execPath, [startScript], {
    cwd: join(__dirname, '..'),
    stdio: 'ignore',
    env: {
      ...process.env,
      NETWORK_ANALYZER_PORT: String(PORT),
      NETWORK_ANALYZER_HOST: HOST,
    },
  });
  serverProcess = child;
  child.on('error', (error) => {
    void dialog.showErrorBox('Failed to start server', String(error.message || error));
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      dialog.showErrorBox('Server stopped', `LAN server exited with code ${code}.`);
    }
  });
}

function registerUpdater() {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'horner516',
    repo: 'lighting-network-analyzer',
  });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', () => {
    createMenu('(update available)');
  });

  autoUpdater.on('update-not-available', () => {
    createMenu('(up to date)');
  });

  autoUpdater.on('download-progress', () => {});

  autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error?.message ?? error);
  });

  autoUpdater.on('update-downloaded', () => {
    void (async () => {
      const result = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        message: 'Update downloaded',
        detail: 'A new version of Lighting Network Analyzer is ready to install.',
      });
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    })();
  });

  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, UPDATER_POLL_MS);
}

app.whenReady().then(async () => {
  createTray();
  registerUpdater();

  spawnServer();
  const ready = await waitForServer();
  if (!ready) {
    void dialog.showErrorBox('Server failed to start', `Unable to reach ${APP_ORIGIN}. Make sure port ${PORT} is available.`);
  }

  createWindow();
  autoUpdater.checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGINT');
  }
});
