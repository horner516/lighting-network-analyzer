const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8');
for (const platform of ['darwin', 'win32']) test(`${platform} starts tray-only and opens the browser only on request`, async () => {
  const events = {}, opened = [], menus = [], errors = [];
  let hidden = 0, trayEvents = {}, closed = 0;
  const app = { isPackaged: false, dock: { hide: () => hidden++ }, getPath: () => '/test-profile', setPath() {}, requestSingleInstanceLock: () => true,
    on: (event, callback) => { events[event] = callback; }, whenReady: async () => {}, quit() {}, getVersion: () => 'test' };
  const image = { resize: () => image };
  const electron = { app, Menu: { buildFromTemplate: x => x }, shell: { openExternal: async url => opened.push(url) },
    BrowserWindow: class { constructor() { throw Error('A desktop window must never be created'); } },
    Tray: class { setToolTip() {} setContextMenu(menu) { menus.push(menu); } on(event, cb) { trayEvents[event] = cb; } },
    nativeImage: { createFromPath: () => image }, dialog: { showErrorBox: (...args) => errors.push(args), showMessageBox: async () => ({ response: 1 }) } };
  const modules = { electron, 'electron-updater': { autoUpdater: { on() {}, setFeedURL() {} } }, 'node:path': path,
    'node:fs': { existsSync: () => false }, './lan-server.cjs': { startLanServer: async () => ({ url: 'http://127.0.0.1:47653', port: 47653, server: { close: () => closed++, closeAllConnections() {} } }) } };
  vm.runInNewContext(source, { require: id => { if (!(id in modules)) throw Error(id); return modules[id]; }, __dirname, process: { platform, env: {} }, setInterval: () => ({ unref() {} }), console });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, []); assert.deepEqual(opened, []);
  assert.equal(hidden, platform === 'darwin' ? 1 : 0);
  const menu = menus.at(-1);
  assert.equal(menu[0].label, 'Open Browser');
  assert.equal(menu.some(item => item.label === 'Open Dashboard'), false);
  assert.ok(menu.some(item => item.label?.startsWith('Check for Updates')));
  menu[0].click(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(opened, ['http://127.0.0.1:47653']);
  assert.equal(typeof trayEvents['double-click'], 'function');
  events['before-quit'](); assert.equal(closed, 1);
});
test('Mac package is configured as a menu-bar agent', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../electron-builder.json')));
  assert.equal(config.mac.extendInfo.LSUIElement, true);
});
