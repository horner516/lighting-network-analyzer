const dgram = require('node:dgram');
const { networkInterfaces } = require('node:os');
const { isIPv4 } = require('node:net');
const ACN_ID = Buffer.from('ASC-E1.17\0\0\0');
const PRESENT_MS = 3000, KEEP_MS = 300000;

function parseUniverses(value = '1-64') {
  const result = new Set();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('sACN universes must be numbers or ranges, such as 1-64,101.');
    const start = Number(match[1]), end = Number(match[2] || start);
    if (start < 1 || end > 63999 || start > end || end - start > 255) throw new Error('Choose up to 256 sACN universes from 1 to 63999.');
    for (let u = start; u <= end; u++) result.add(u);
    if (result.size > 256) throw new Error('Choose up to 256 sACN universes.');
  }
  return [...result].sort((a, b) => a - b);
}
function pduLength(b, offset) { return (b[offset] & 0xf0) === 0x70 && (b.readUInt16BE(offset) & 0xfff) === b.length - offset; }
function decodeSacn(b) {
  if (b.length < 126 || b.length > 638 || b.readUInt16BE(0) !== 16 || b.readUInt16BE(2) !== 0 || !b.subarray(4, 16).equals(ACN_ID)) return null;
  if (!pduLength(b, 16) || b.readUInt32BE(18) !== 4 || !pduLength(b, 38) || b.readUInt32BE(40) !== 2 || !pduLength(b, 115)) return null;
  const count = b.readUInt16BE(123), universe = b.readUInt16BE(113);
  if (b[117] !== 2 || b[118] !== 0xa1 || b.readUInt16BE(119) !== 0 || b.readUInt16BE(121) !== 1 || count < 1 || count > 513 || b.length !== 125 + count || universe < 1 || universe > 63999 || b[108] > 200) return null;
  const sourceName = b.subarray(44, 108).toString('utf8').split('\0')[0].replace(/[\x00-\x1f\x7f]/g, '');
  return { protocol: 'sACN', universe, cid: b.subarray(22, 38).toString('hex'), sourceName, priority: b[108], sequence: b[111], preview: !!(b[112] & 0x80), terminated: !!(b[112] & 0x40), startCode: b[125], slots: count - 1, levels: [...b.subarray(126)] };
}
function decodeArtNet(b) {
  if (b.length < 18 || !b.subarray(0, 8).equals(Buffer.from('Art-Net\0')) || b.readUInt16LE(8) !== 0x5000 || b.readUInt16BE(10) < 14) return null;
  const count = b.readUInt16BE(16), universe = b.readUInt16LE(14);
  if (count < 2 || count > 512 || count % 2 || b.length !== 18 + count || universe > 32767) return null;
  return { protocol: 'Art-Net', universe, cid: '', sourceName: '', priority: null, sequence: b[12], slots: count, levels: [...b.subarray(18)] };
}
// Receive only: never send discovery, DMX levels or configuration commands.
function createSignalListener({ universeSpec = process.env.LNA_SACN_UNIVERSES || '1-64', interfaceIp = process.env.LNA_INTERFACE || '', ports = { sacn: 5568, artnet: 6454 }, bindAddress = '0.0.0.0', joinMulticast = true, now = Date.now } = {}) {
  const rows = new Map(), sockets = [], memberships = [];
  const protocols = { 'sACN': { port: ports.sacn, status: 'starting', error: '', received: 0, ignored: 0, peakRate: 0 }, 'Art-Net': { port: ports.artnet, status: 'starting', error: '', received: 0, ignored: 0, peakRate: 0 } };
  const protocolBuckets = { 'sACN': [], 'Art-Net': [] };
  const interfaces = Object.entries(networkInterfaces()).flatMap(([name, list]) => (list || []).filter(n => n.family === 'IPv4' && !n.internal).map(n => ({ name, address: n.address })));
  let universes = [], closed = false, droppedSources = 0, configError = '';
  try {
    universes = parseUniverses(universeSpec);
    if (interfaceIp && (!isIPv4(interfaceIp) || !interfaces.some(n => n.address === interfaceIp))) throw new Error('LNA_INTERFACE must be an IPv4 address on an active local adapter.');
  } catch (error) { configError = error.message; }
  function ingest(protocol, b, remote) {
    const p = protocols[protocol], frame = protocol === 'sACN' ? decodeSacn(b) : decodeArtNet(b);
    if (!frame || (protocol === 'sACN' && (frame.preview || frame.startCode !== 0))) { p.ignored++; return; }
    const t = now(), key = `${protocol}:${remote.address}:${frame.cid}:${frame.universe}`;
    for (const [id, row] of rows) if (t - row.lastSeen > KEEP_MS) rows.delete(id);
    let row = rows.get(key);
    if (frame.terminated) { if (row) row.terminated = true; return; }
    // A multicast packet can arrive on overlapping adapters. Do not inflate rates.
    if (row && (protocol === 'sACN' || frame.sequence !== 0) && row.sequence === frame.sequence && t - row.lastSeen < 100 && !row.terminated) return;
    if (!row && rows.size >= 1024) { droppedSources++; return; }
    if (!row) { row = { id: key, firstSeen: t, packets: 0, buckets: [] }; rows.set(key, row); }
    Object.assign(row, frame, { ip: remote.address, lastSeen: t, terminated: false });
    row.packets++; p.received++;
    const second = Math.floor(t / 1000);
    row.buckets = row.buckets.filter(b => b.second > second - 5);
    let bucket = row.buckets.find(b => b.second === second);
    if (!bucket) { bucket = { second, count: 0 }; row.buckets.push(bucket); }
    bucket.count++;
    // Server-owned high-water mark, independent of browser polling or tab state.
    protocolBuckets[protocol] = protocolBuckets[protocol].filter(b => b.second > second - 5);
    let totalBucket = protocolBuckets[protocol].find(b => b.second === second);
    if (!totalBucket) { totalBucket = { second, count: 0 }; protocolBuckets[protocol].push(totalBucket); }
    totalBucket.count++;
    p.peakRate = Math.max(p.peakRate, protocolBuckets[protocol].reduce((n, b) => n + b.count, 0) / 5);
  }
  async function listen(protocol) {
    const p = protocols[protocol];
    if (configError) { p.status = 'error'; p.error = configError; return; }
    async function bind(groups = [], membership = null) {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: protocol === 'sACN' });
      sockets.push(socket);
      socket.on('message', (b, remote) => ingest(protocol, b, remote));
      socket.on('error', error => { p.status = 'error'; p.error = `${error.code || 'UDP'}: ${error.message}`; });
      return new Promise(resolve => {
        socket.once('error', () => resolve(false));
        socket.bind(p.port, bindAddress, () => {
          p.port = socket.address().port;
          for (const u of groups) {
            try { socket.addMembership(`239.255.${u >> 8}.${u & 255}`, membership.address); membership.joined++; }
            catch (e) { membership.failed++; membership.error = e.code || e.message; }
          }
          socket.unref(); resolve(socket);
        });
      });
    }
    const primary = await bind();
    if (!primary) return;
    p.status = 'listening';
    if (protocol === 'sACN' && joinMulticast) {
      const candidates = interfaceIp ? interfaces.filter(n => n.address === interfaceIp) : interfaces;
      for (const nic of candidates) {
        const membership = { ...nic, joined: 0, failed: 0, error: '' };
        memberships.push(membership);
        // macOS permits large membership sets but duplicates across sockets can
        // exhaust kernel resources, particularly with a VLAN and its parent NIC.
        if (process.platform === 'darwin') {
          for (const u of universes) {
            try { primary.addMembership(`239.255.${u >> 8}.${u & 255}`, membership.address); membership.joined++; }
            catch (e) { membership.failed++; membership.error = e.code || e.message; }
          }
          continue;
        }
        // Small batches avoid per-socket multicast membership limits on desktop OSes.
        for (let i = 0; i < universes.length; i += 16) {
          const groups = universes.slice(i, i + 16);
          if (!await bind(groups, membership)) { membership.failed += groups.length; membership.error = p.error; }
        }
      }
      if (!candidates.length || memberships.some(m => m.failed)) { p.status = 'limited'; p.error = 'Some multicast subscriptions are unavailable. Check adapter, universe range, and OS membership limits.'; }
    }
  }
  const ready = Promise.all([listen('sACN'), listen('Art-Net')]);
  function snapshot() {
    const t = now(), second = Math.floor(t / 1000), signals = [];
    for (const [key, row] of rows) {
      if (t - row.lastSeen > KEEP_MS) { rows.delete(key); continue; }
      const { buckets, levels, ...data } = row;
      const available = ['listening', 'limited'].includes(protocols[row.protocol].status);
      const status = !available ? 'unavailable' : row.terminated ? 'terminated' : t - row.lastSeen > PRESENT_MS ? 'timed-out' : 'present';
      signals.push({ ...data, status, rate: status === 'present' ? buckets.filter(b => b.second > second - 5).reduce((n, b) => n + b.count, 0) / 5 : 0, nonzero: levels.filter(n => n > 0).length, previewLevels: levels.slice(0, 16) });
    }
    return { available: true, sampledAt: t, presentTimeoutMs: PRESENT_MS, universeSpec, interfaces, memberships, protocols, signals: signals.sort((a, b) => a.protocol.localeCompare(b.protocol) || a.universe - b.universe || a.ip.localeCompare(b.ip)), droppedSources };
  }
  function close() { if (closed) return; closed = true; for (const s of sockets) { try { s.close(); } catch {} } for (const p of Object.values(protocols)) p.status = 'stopped'; }
  return { ready, snapshot, close, ingest };
}
module.exports = { createSignalListener, decodeSacn, decodeArtNet, parseUniverses };
