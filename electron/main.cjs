const { app, BrowserWindow, Menu, shell, Tray, nativeImage, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { join } = require('node:path');
const { writeFileSync } = require('node:fs');
const { startLanServer } = require('./lan-server.cjs');

const releases = 'https://github.com/horner516/lighting-network-analyzer/releases/latest';
let mainWindow;
let tray;
let lan;
let quitting = false;
let updateState = '';
let checking = false;
const iconPath = join(__dirname, '..', 'public', process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png');

function showDashboard() {
  if (!lan) return;
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); return; }
  mainWindow = new BrowserWindow({
    width: 1360, height: 920, minWidth: 800, minHeight: 600,
    icon: iconPath, title: `Lux Link v${app.getVersion()}`,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === lan.url || lan.info().urls.includes(url.replace(/\/$/, '')) || url === releases) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== lan.url) event.preventDefault();
  });
  mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(lan.url);
}

function refreshMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: showDashboard },
    { label: 'Open in Browser', click: () => shell.openExternal(lan.url) },
    { label: `Server port: ${lan.port}`, enabled: false },
    { type: 'separator' },
    { label: `Check for Updates${updateState ? ` (${updateState})` : ''}`, enabled: !checking, click: () => checkForUpdates(true) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

async function checkForUpdates(manual = false) {
  if (checking) return;
  if (!app.isPackaged) {
    if (manual) await dialog.showMessageBox({ message: 'Update checks are available in the installed app.' });
    return;
  }
  checking = true;
  updateState = 'checking'; refreshMenu();
  try {
    const result = await autoUpdater.checkForUpdates();
    const available = result?.isUpdateAvailable === true;
    updateState = available ? 'update available' : 'up to date';
    if (available && manual) {
      const answer = await dialog.showMessageBox({ message: 'A new version is available.', detail: process.platform === 'darwin' ? 'Download the latest Mac installer from GitHub.' : 'Download and install this update?', buttons: ['Download', 'Later'], cancelId: 1 });
      if (answer.response === 0) {
        if (process.platform === 'darwin') await shell.openExternal(releases);
        else await autoUpdater.downloadUpdate();
      }
    } else if (manual && !available) await dialog.showMessageBox({ message: 'You are running the latest version.' });
  } catch (error) {
    updateState = 'check failed';
    if (manual) dialog.showErrorBox('Update check failed', String(error.message || error));
  } finally { checking = false; refreshMenu(); }
}

function setupUpdater() {
  autoUpdater.setFeedURL({ provider: 'github', owner: 'horner516', repo: 'lighting-network-analyzer' });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('error', () => { updateState = 'check failed'; refreshMenu(); });
  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox({ message: 'Update ready to install.', buttons: ['Restart and install', 'Later'], cancelId: 1 });
    if (result.response === 0) { quitting = true; autoUpdater.quitAndInstall(); }
  });
  setInterval(() => void checkForUpdates(), 30 * 60 * 1000).unref();
  void checkForUpdates();
}

// Preserve saved browser data and single-instance identity across the Lux Link rename.
app.setPath('userData', join(app.getPath('appData'), 'lighting-network-analyzer'));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showDashboard);
  app.whenReady().then(async () => {
    lan = await startLanServer({ root: join(__dirname, '..', 'desktop-web'), preferredPort: Number(process.env.NETWORK_ANALYZER_PORT || 47652), host: process.env.NETWORK_ANALYZER_HOST || '0.0.0.0' });
    // Used by packaged smoke checks; never enables Node access in the renderer.
    if (process.env.LNA_SMOKE_TEST === '1') {
      const response = await fetch(lan.url);
      const info = await fetch(`${lan.url}/api/server-info`).then(result => result.json());
      if (!response.ok || info.port !== lan.port) throw new Error('Packaged server smoke check failed.');
      console.log('LNA_SMOKE_OK', JSON.stringify({ port: lan.port, version: app.getVersion() }));
      if (process.env.LNA_SMOKE_RESULT) writeFileSync(process.env.LNA_SMOKE_RESULT, JSON.stringify({ ok: true, port: lan.port, version: app.getVersion() }));
      app.quit(); return;
    }
    const trayImage = nativeImage.createFromPath(iconPath);
    tray = new Tray(process.platform === 'darwin' ? trayImage.resize({ width: 22, height: 22 }) : trayImage);
    tray.setToolTip('Lux Link');
    refreshMenu();
    tray.on('double-click', showDashboard);
    showDashboard();
    setupUpdater();
  }).catch(error => {
    if (process.env.LNA_SMOKE_TEST === '1') { console.error(error); app.exit(1); return; }
    dialog.showErrorBox('Unable to start Lux Link', String(error.message || error));
    app.quit();
  });
}

app.on('activate', showDashboard);
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; lan?.server.close(); lan?.server.closeAllConnections(); });
