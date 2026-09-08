const fs = require('node:fs');
const path = require('node:path');
const { validTarget } = require('./node-poller.cjs');

function deviceEntry(value) {
  const parts = typeof value?.ip === 'string' ? value.ip.trim().split('.') : [];
  const ip = parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255) ? parts.map(Number).join('.') : '';
  if (!validTarget(ip)) throw new RangeError('Enter a private LAN or 2.x lighting-network IPv4 host address.');
  const name = typeof value.name === 'string' ? value.name.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 128) : '';
  const deviceType = ['Console', 'Node', 'Switch'].includes(value.deviceType) ? value.deviceType : 'Node';
  return { ip, name: name || `Device ${ip}`, source: 'manual', state: 'Unverified', deviceType };
}

function createDeviceInventory({ file = null, poll, intervalMs = 15000 }) {
  let devices = [], info = {}, pollingIp = '', running = null, runningTargets = new Set(), timer, stopped = false, storageError = '', legacyImportClosed = false;
  if (file && fs.existsSync(file)) {
    try {
      if (fs.statSync(file).size > 131072) throw Error('Too large');
      const document = JSON.parse(fs.readFileSync(file, 'utf8'));
      const stored = Array.isArray(document) ? document : document?.version === 1 ? document.devices : null;
      legacyImportClosed = !Array.isArray(document) && document?.legacyImportClosed === true;
      if (!Array.isArray(stored) || stored.length > 256) throw Error('Invalid inventory');
      devices = stored.map(deviceEntry).filter((d, i, all) => all.findIndex(x => x.ip === d.ip) === i);
    } catch { storageError = 'The saved server device list could not be read. Existing file was left unchanged.'; }
  }
  function persist(next, closeLegacyImport = legacyImportClosed) {
    if (storageError) throw Error(storageError);
    if (file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      try { fs.writeFileSync(temporary, JSON.stringify({ version: 1, devices: next, legacyImportClosed: closeLegacyImport }, null, 2), { mode: 0o600 }); fs.renameSync(temporary, file); }
      catch { throw Error('The server could not save its device list. No changes were applied.'); }
    }
    devices = next;
    legacyImportClosed = closeLegacyImport;
  }
  function snapshot() { return { shared: true, devices: devices.map(d => ({ ...d })), info: { ...info }, busy: Boolean(running), pollingIp, error: storageError }; }
  function refresh({ deviceType = '', ips = null, all = false } = {}) {
    if (stopped) return Promise.resolve();
    const targets = devices.filter(device => all || (Array.isArray(ips) ? ips.includes(device.ip) : deviceType ? device.deviceType === deviceType : device.deviceType !== 'Console')).map(device => device.ip);
    if (running) {
      const missing = targets.filter(ip => !runningTargets.has(ip));
      return missing.length ? running.then(() => refresh({ ips: missing })) : running;
    }
    clearTimeout(timer);
    runningTargets = new Set(targets);
    // Set running before the first physical request so concurrent browsers share one cycle.
    running = Promise.resolve().then(async () => {
      const visited = new Set();
      while (!stopped) {
        const device = devices.find(d => !visited.has(d.ip) && runningTargets.has(d.ip));
        if (!device) break;
        visited.add(device.ip); pollingIp = device.ip;
        try { const result = await poll(device.ip, { deviceType: device.deviceType }); if (devices.includes(device)) info[device.ip] = result; }
        catch { if (devices.includes(device)) info[device.ip] = { ip: device.ip, checkedAt: Date.now(), responding: false, ports: [], firmwareCode: null, error: 'Device polling failed.' }; }
      }
    }).finally(() => {
      running = null; runningTargets = new Set(); pollingIp = '';
      if (!stopped) { timer = setTimeout(refresh, intervalMs); timer.unref?.(); }
    });
    return running;
  }
  function add(entries, { legacyImport = false } = {}) {
    if (legacyImport && legacyImportClosed) return snapshot();
    if (!Array.isArray(entries) || !entries.length || entries.length > 256) throw new RangeError('Supply between 1 and 256 devices.');
    const next = [...devices], added = [];
    for (const entry of entries.map(deviceEntry)) if (!next.some(d => d.ip === entry.ip)) { next.push(entry); added.push(entry.ip); }
    if (next.length > 256) throw new RangeError('The server supports up to 256 configured devices.');
    if (next.length !== devices.length) { persist(next); void refresh({ ips: added }); }
    return snapshot();
  }
  function layout({ baseOrder, order } = {}) {
    const validList = list => Array.isArray(list) && list.length <= 256 && list.every(ip => typeof ip === 'string') && new Set(list).size === list.length;
    if (!validList(baseOrder) || !validList(order)) throw new RangeError('Layout must contain unique device IP addresses.');
    if (JSON.stringify(baseOrder) !== JSON.stringify(devices.map(d => d.ip))) {
      const error = new Error('The device list changed in another browser. Reopen Layout and try again.'); error.statusCode = 409; throw error;
    }
    const byIp = new Map(devices.map(d => [d.ip, d]));
    if (order.some(ip => !byIp.has(ip))) throw new RangeError('Layout contains an unconfigured device.');
    const next = order.map(ip => byIp.get(ip));
    persist(next, true);
    for (const ip of Object.keys(info)) if (!order.includes(ip)) delete info[ip];
    return snapshot();
  }
  function updateInfo(ip, value) {
    if (!devices.some(device => device.ip === ip)) throw new RangeError('Add this node to the shared device list before editing it.');
    info[ip] = value;
    return snapshot();
  }
  return { snapshot, add, layout, refresh, updateInfo, start: () => { void refresh(); }, close: () => { stopped = true; clearTimeout(timer); } };
}
module.exports = { createDeviceInventory, deviceEntry };
