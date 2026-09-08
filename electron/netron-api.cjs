const http = require('node:http');
const { validTarget } = require('./node-poller.cjs');
const { pollProplex, updatePortUniverses: updateProplexPortUniverses } = require('./proplex-web.cjs');
const { pollMaConsole } = require('./ma-console.cjs');
const { pollEtcConsole } = require('./etc-console.cjs');
const { createReachabilityProbe } = require('./reachability.cjs');

// Read endpoints used by the NETRON EN12 V2.9.2 web monitor. Never call
// configuration, cue, firmware or other write endpoints.
const paths = new Set(['/Setting.json', '/index.json', '/IP.json', '/DMXPorts.json']);
function readJson(ip, path) {
  if (!validTarget(ip) || !paths.has(path)) return Promise.reject(new Error('Unsupported device request.'));
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: ip, port: 80, path, method: 'GET', agent: false }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`NETRON ${path}: HTTP ${res.statusCode}`)); return; }
      const chunks = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 131072) req.destroy(new Error('Device response exceeded the size limit.'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new Error(`NETRON ${path}: invalid JSON`)); }
      });
    });
    const timer = setTimeout(() => req.destroy(new Error('Device web API timed out.')), 2000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
  });
}
const str = v => typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 128) : '';
const num = v => (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) && Number.isInteger(Number(v)) ? Number(v) : null;
const bool = v => num(v) === 1 ? true : num(v) === 0 ? false : null;
function normalizeIp(v) {
  if (typeof v !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(v) || v.split('.').some(n => Number(n) > 255)) return null;
  return v.split('.').map(Number).join('.');
}
function normalizeNetron(ip, settings, identity, network, rawPorts, warnings = []) {
  if (!/^NETRON\s+\S/i.test(str(settings?.DeviceType))) throw new Error('Not a recognized NETRON device.');
  const globalRdm = bool(settings.GlobalRDMmode);
  const ports = Array.isArray(rawPorts) ? rawPorts.slice(0, 64).map((raw, index) => {
    const p = raw || {}, mode = num(p.ptMode), protocolCode = num(p.ptProtocol);
    const configured = mode === 1 || mode === 2;
    const protocol = configured ? ({ 0: 'Art-Net', 1: 'sACN' }[protocolCode] || null) : null;
    const value = num(p.ptUniverse);
    const address = protocol && value !== null && value >= (protocol === 'sACN' ? 1 : 0) && value <= (protocol === 'sACN' ? 63999 : 32767) ? value : null;
    const portRdm = configured ? bool(p.ptRDM) : null;
    const displayUniverse = address !== null && protocol === 'Art-Net' && num(settings.UniverseMode) === 0 ? address + 1 : address;
    return { index, label: String(index + 1), direction: ({ 0: 'Disabled', 1: 'IN', 2: 'OUT', 3: 'Send Value' })[mode] || 'Unknown',
      inputAddress: mode === 1 ? address : null, outputAddress: mode === 2 ? address : null,
      inputProtocol: mode === 1 ? protocol : null, outputProtocol: mode === 2 ? protocol : null,
      displayUniverse, addressNote: protocol === 'Art-Net' && displayUniverse !== address ? `Web-monitor universe ${displayUniverse}; native Art-Net address ${address}.` : '',
      rdm: configured && (globalRdm === false || portRdm === false) ? false : configured && globalRdm === true && portRdm === true ? true : null,
      portRdm, globalRdm, active: null, error: null,
      frameRate: mode !== 0 ? [10, 15, 20, 25, 30, 35, 40][num(p.ptFramerate)] ?? null : null,
      mergeMode: ['Off', 'HTP', 'LTP', 'Toggle', 'Backup'][num(p.ptMergeMode)] || 'Unknown',
      channelFrom: num(p.ptRangeFrom), channelTo: num(p.ptRangeTo), channelOffset: num(p.ptOffsetAddr),
    };
  }) : [];
  return { ip, checkedAt: Date.now(), responding: true, online: true, reachabilitySource: 'web', source: 'NETRON web API',
    name: str(settings.DeviceName), description: str(settings.DeviceType), proplex: false,
    subnetMask: normalizeIp(network?.netmask), reportedIp: normalizeIp(network?.ipaddress),
    firmware: str(identity?.FirmwareVer), firmwareCode: null, mac: str(identity?.MACAddress), uptime: str(identity?.OnTime),
    report: 'Configuration retrieved', ports,
    note: 'Configuration read from the NETRON web monitor. This does not confirm signal presence or device health. Art-Net tile numbers match the device web monitor; port details include native addresses.',
    error: warnings.join(' '),
  };
}

function createDevicePoller({ read = readJson, proplexPoll = pollProplex, proplexUpdate = updateProplexPortUniverses, maPoll = pollMaConsole, etcPoll = pollEtcConsole, ping = createReachabilityProbe(), now = Date.now } = {}) {
  const pending = new Map(), cache = new Map();
  async function consolePoll(ip) {
    try { return await maPoll(ip); }
    catch {
      try { return await etcPoll(ip); }
      catch {
        const online = await ping(ip).catch(() => false);
        return { ip, checkedAt: now(), responding: false, online, reachabilitySource: online ? 'ping' : 'none', source: 'Console detection', name: '', description: '', consoleBrand: 'Unknown',
          proplex: false, ports: [], subnetMask: null, firmwareCode: null, mac: '', report: '', metadataStatus: 'No supported console service was detected.',
          note: 'Lux Link checked MA Web Remote and ETC Eos OSC without sending control commands.',
          error: online ? 'Console answered ping, but its manufacturer could not be identified.' : 'Console detection and four ping attempts failed.' };
      }
    }
  }
  async function fallback(ip) {
    try { return await proplexPoll(ip); }
    catch {
      const online = await ping(ip).catch(() => false);
      return { ip, checkedAt: now(), responding: false, online, reachabilitySource: online ? 'ping' : 'none', source: 'Device web/API polling', name: '', description: '',
        proplex: false, ports: [], subnetMask: null, firmwareCode: null, mac: '', report: '',
        note: 'Device information comes only from its live web/API response, not Art-Net discovery.',
        error: online ? 'Device answered ping, but its web/API format is unavailable or unsupported.' : 'Device web/API polling and four ping attempts failed.' };
    }
  }
  async function collect(ip, deviceType = '') {
    if (deviceType === 'Console') return consolePoll(ip);
    let settings;
    try { settings = await read(ip, '/Setting.json'); } catch { return fallback(ip); }
    if (!/^NETRON\s+\S/i.test(str(settings?.DeviceType))) return fallback(ip);
    const resources = ['/index.json', '/IP.json', '/DMXPorts.json'];
    // Sequential reads accommodate small embedded web servers.
    const values = [], warnings = [];
    for (const path of resources) {
      try { values.push(await read(ip, path)); }
      catch { values.push(null); warnings.push(`${path === '/DMXPorts.json' ? 'Port configuration' : path === '/IP.json' ? 'Network settings' : 'Firmware/MAC information'} unavailable.`); }
    }
    if (!Array.isArray(values[2]) && values[2] !== null) warnings.push('Unsupported port response.');
    return normalizeNetron(ip, settings, ...values, warnings);
  }
  function poll(ip, { deviceType = '' } = {}) {
    if (!validTarget(ip)) return Promise.reject(new RangeError('Use a private LAN or 2.x lighting-network IPv4 host address.'));
    const key = `${deviceType || 'Device'}:${ip}`;
    if (pending.has(key)) return pending.get(key);
    const prior = cache.get(key);
    if (prior && now() - prior.at < 5000) return Promise.resolve(prior.value);
    if (pending.size >= 4) return Promise.reject(new Error('Other nodes are being polled. Try again shortly.'));
    const result = collect(ip, deviceType).then(value => {
      cache.set(key, { at: now(), value });
      if (cache.size > 256) cache.delete(cache.keys().next().value);
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, result);
    return result;
  }
  async function updatePortUniverses(ip, updates) {
    if (!validTarget(ip)) throw new RangeError('Use a private LAN or 2.x lighting-network IPv4 host address.');
    const key = `Device:${ip}`;
    if (pending.has(key)) await pending.get(key);
    await proplexUpdate(ip, updates);
    cache.delete(key);
    const value = await collect(ip);
    cache.set(key, { at: now(), value });
    return value;
  }
  return { poll, updatePortUniverses };
}
module.exports = { readJson, normalizeNetron, createDevicePoller };
