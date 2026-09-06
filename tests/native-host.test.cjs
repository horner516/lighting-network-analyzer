const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('native Mac host is a menu-bar agent and does not open a browser at startup', () => {
  const swift = fs.readFileSync(path.join(__dirname, '../native-mac/LuxLinkHost.swift'), 'utf8');
  const plist = fs.readFileSync(path.join(__dirname, '../native-mac/Info.plist'), 'utf8');
  const packageJson = require('../package.json');
  assert.match(swift, /setActivationPolicy\(\.accessory\)/);
  assert.match(swift, /Open Browser/);
  assert.doesNotMatch(swift.split('func applicationDidFinishLaunching')[1].split('private func startServer')[0], /openBrowser\(/);
  assert.match(plist, /<key>LSUIElement<\/key><true\/>/);
  assert.match(plist, new RegExp(`<string>${packageJson.version.replaceAll('.', '\\.')}<\\/string>`));
});

test('native installer is arm64-only and omits Electron packaging', () => {
  const script = fs.readFileSync(path.join(__dirname, '../scripts/build-mac-native.sh'), 'utf8');
  const packageJson = require('../package.json');
  assert.match(script, /arm64-apple-macos13\.0/);
  assert.match(script, /NODE_BINARY must be an Apple silicon/);
  assert.equal(packageJson.devDependencies.electron, undefined);
  assert.equal(packageJson.devDependencies['electron-builder'], undefined);
  assert.equal(packageJson.dependencies['electron-updater'], undefined);
  assert.match(script, /MAWebRemoteReader\.m/);
  assert.match(script, /-framework Vision -framework WebKit/);
  assert.doesNotMatch(script, /Chromium|puppeteer|playwright/i);
});
