const net = require('node:net');
const { validTarget } = require('./node-poller.cjs');

function broadcastAddress(address, netmask) {
  const ip = address.split('.').map(Number), mask = netmask.split('.').map(Number);
  if (ip.length !== 4 || mask.length !== 4 || [...ip, ...mask].some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ip.map((n, i) => (n & mask[i]) | (255 ^ mask[i])).join('.');
}

function subnet24(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return [];
  return Array.from({ length: 254 }, (_, index) => `${parts[0]}.${parts[1]}.${parts[2]}.${index + 1}`);
}

function tcpOpen(ip, port, timeoutMs = 220) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: ip, port });
    let done = false;
    const finish = value => { if (done) return; done = true; socket.destroy(); resolve(value); };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function mapLimited(values, limit, worker) {
  const output = Array.from({ length:values.length }); let next = 0;
  async function run() { while (next < values.length) { const index = next++; output[index] = await worker(values[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return output;
}

function createDeviceDiscovery({ interfaces, artDiscover, signalSnapshot, pollDevice, probe = tcpOpen } = {}) {
  let running = null;
  async function scan({ address = '', deep = false, configured = [] } = {}) {
    if (running) return running;
    const task = (async () => {
      const adapters = interfaces();
      if (address && !adapters.some(item => item.address === address)) throw new RangeError('Choose an active network connection.');
      const selected = address ? adapters.filter(item => item.address === address) : adapters;
      if (deep && selected.length !== 1) throw new RangeError('Choose one network connection before starting a deep scan.');
      if (deep && !validTarget(selected[0].address)) throw new RangeError('Deep scan is limited to private LAN and 2.x lighting-network adapters.');
      // Send both the adapter's directed broadcast and the Art-Net convention's
      // limited broadcast. Some lighting interfaces use intentionally broad
      // masks while their embedded nodes answer only 255.255.255.255.
      const broadcasts = [...new Set([...selected.map(item => broadcastAddress(item.address, item.netmask)).filter(Boolean), '255.255.255.255'])];
      const artNodes = await artDiscover(broadcasts).catch(() => []);
      const artByIp = new Map(artNodes.map(item => [item.ip, item]));
      const signals = signalSnapshot()?.signals || [];
      const candidates = new Map();
      for (const item of artNodes) candidates.set(item.ip, { ip:item.ip, ports:new Set([6454]), evidence:new Set(['Art-Net discovery reply']) });
      for (const item of signals) if (validTarget(item.ip) && /(?:grandMA|\bMA\b|ETC|Eos|Gio|Ion|Nomad|Element)/i.test(item.sourceName || '')) {
        if (!candidates.has(item.ip)) candidates.set(item.ip, { ip:item.ip, ports:new Set(), evidence:new Set() });
        candidates.get(item.ip).evidence.add(`${item.protocol} source observed`);
      }
      if (deep) {
        const hosts = subnet24(selected[0].address).filter(ip => ip !== selected[0].address);
        const found = await mapLimited(hosts, 32, async ip => {
          const ports = [];
          for (const port of [80, 8080, 3032, 3037]) if (await probe(ip, port)) ports.push(port);
          return ports.length ? { ip, ports } : null;
        });
        for (const item of found.filter(Boolean)) {
          if (!candidates.has(item.ip)) candidates.set(item.ip, { ip:item.ip, ports:new Set(), evidence:new Set(['Deep scan response']) });
          for (const port of item.ports) candidates.get(item.ip).ports.add(port);
        }
      }
      const known = new Set(configured);
      const results = (await mapLimited([...candidates.values()], 4, async candidate => {
        const art = artByIp.get(candidate.ip);
        const consoleFirst = !art && (candidate.ports.has(3032) || candidate.ports.has(3037) || candidate.ports.has(8080) || candidate.evidence.has('sACN source observed') || candidate.evidence.has('Art-Net source observed'));
        let requestedType = consoleFirst ? 'Console' : 'Node';
        let info;
        try { info = await pollDevice(candidate.ip, { deviceType:requestedType }); } catch { info = null; }
        if (requestedType === 'Console' && (!info?.responding || info.consoleBrand === 'Unknown') && (art || candidate.ports.has(80))) {
          requestedType = 'Node';
          try { info = await pollDevice(candidate.ip, { deviceType:'Node' }); } catch { info = null; }
        }
        if (info?.consoleBrand && info.consoleBrand !== 'Unknown') requestedType = 'Console';
        else if (!art && !info?.responding) return null;
        else requestedType = 'Node';
        const brand = requestedType === 'Console' ? info.consoleBrand : info?.proplex || art?.proplex ? 'TMB ProPlex' : /^NETRON\b/i.test(info?.description || '') ? 'Obsidian' : 'Art-Net';
        const name = info?.name || art?.description || art?.name || `${brand} device`;
        if (info?.source) candidate.evidence.add(info.source);
        return { ip:candidate.ip, name, brand, deviceType:requestedType, model:info?.description || art?.description || '', evidence:[...candidate.evidence], alreadyAdded:known.has(candidate.ip), confidence:info?.responding ? 'Verified' : 'Discovered' };
      })).filter(Boolean);
      return { scannedAt:Date.now(), interface:address || 'All active adapters', deep:Boolean(deep), results:results.sort((a,b) => a.ip.localeCompare(b.ip, undefined, { numeric:true })) };
    })().finally(() => { running = null; });
    running = task; return task;
  }
  return { scan };
}

module.exports = { broadcastAddress, subnet24, tcpOpen, createDeviceDiscovery };
