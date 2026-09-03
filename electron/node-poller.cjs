const { isIPv4 } = require('node:net');
const ID = Buffer.from('Art-Net\0');
const text = (b, start, length) => b.subarray(start, start + length).toString('utf8').split('\0')[0].replace(/[\x00-\x1f\x7f]/g, '').trim();
const ipAt = (b, start) => [...b.subarray(start, start + 4)].join('.');

// Art-Net specification: https://art-net.org.uk/downloads/art-net.pdf
// These packets request status only. ArtIpProg Command is deliberately ZERO.
function queries() {
  const poll = Buffer.alloc(14); ID.copy(poll); poll.writeUInt16LE(0x2000, 8); poll.writeUInt16BE(14, 10);
  const ip = Buffer.alloc(34); ID.copy(ip); ip.writeUInt16LE(0xf800, 8); ip.writeUInt16BE(14, 10);
  return [poll, ip];
}
function validTarget(ip) {
  if (!isIPv4(ip)) return false;
  const [a, b, , d] = ip.split('.').map(Number);
  return d !== 255 && d !== 0 && (a === 10 || a === 2 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254));
}
function decodeReply(b) {
  if (b.length < 10 || !b.subarray(0, 8).equals(ID)) return null;
  const op = b.readUInt16LE(8);
  if (op === 0xf900 && b.length >= 30 && b.readUInt16BE(10) >= 14) return { kind: 'ip', ip: ipAt(b, 16), subnetMask: ipAt(b, 20) };
  if (op !== 0x2100 || b.length < 207) return null;
  const count = b.readUInt16BE(172);
  if (count > 4) return null;
  const bindIndex = b.length > 211 ? b[211] : 0;
  const ports = [];
  for (let i = 0; i < count; i++) {
    const type = b[174 + i], input = !!(type & 0x40), output = !!(type & 0x80);
    const inputStatus = b[178 + i], outputStatus = b[182 + i];
    const direction = input && output ? 'IN/OUT' : output ? 'OUT' : input ? 'IN' : 'Disabled';
    const address = offset => ((b[18] & 0x7f) << 8) | ((b[19] & 15) << 4) | (b[offset + i] & 15);
    ports.push({ index: Math.max(0, bindIndex - 1) * count + i, bindIndex, direction,
      inputAddress: input ? address(186) : null, outputAddress: output ? address(190) : null,
      inputProtocol: input ? (inputStatus & 1 ? 'sACN' : 'Art-Net') : null,
      outputProtocol: output ? (outputStatus & 1 ? 'sACN' : 'Art-Net') : null,
      active: output ? !!(outputStatus & 128) : input ? !!(inputStatus & 128) : null,
      rdm: output && (b[23] & 2) && b.length >= 217 && (b[212] & 128) ? !(b[213 + i] & 128) : null,
      error: output && (outputStatus & 4) ? 'Output short reported' : input && (inputStatus & 4) ? 'Input receive errors' : null,
    });
  }
  return { kind: 'poll', bindIndex, name: text(b, 26, 18), description: text(b, 44, 64), report: text(b, 108, 64), firmwareCode: b.readUInt16BE(16), oemCode: b.readUInt16BE(20), manufacturerCode: b.readUInt16LE(24), mac: [...b.subarray(201, 207)].map(n => n.toString(16).padStart(2, '0')).join(':'), ports };
}
function createNodePoller({ send, now = Date.now, waitMs = 3000 }) {
  const pending = new Map(), cache = new Map();
  function receive(b, remote) {
    const item = pending.get(remote.address);
    if (!item) return false;
    const reply = decodeReply(b);
    if (!reply) return false;
    if (reply.kind === 'ip') item.subnetMask = reply.subnetMask;
    else item.groups.set(reply.bindIndex, reply);
    return true;
  }
  function poll(ip) {
    if (!validTarget(ip)) return Promise.reject(new RangeError('Use a private LAN or 2.x lighting-network IPv4 host address.'));
    if (pending.has(ip)) return pending.get(ip).promise;
    const previous = cache.get(ip);
    if (previous && now() - previous.checkedAt < 5000) return Promise.resolve(previous);
    if (pending.size >= 4) return Promise.reject(new Error('Other nodes are being polled. Try again shortly.'));
    const item = { groups: new Map(), subnetMask: null };
    const promise = new Promise(resolve => {
      item.finish = error => {
        clearTimeout(item.timer); pending.delete(ip);
        const groups = [...item.groups.values()].sort((a, b) => a.bindIndex - b.bindIndex);
        const first = groups[0];
        // IQ Two publishes extra merge/master bindings. Only A|..P| identify
        // primary physical ports. A zero Art-Net PortType does not establish
        // that the physical port is disabled (it may be running sACN).
        const proplex = /^IQ Two\b/i.test(first?.description || '');
        const physical = proplex ? groups.filter(group => /^[A-P]\|/.test(group.name)) : groups;
        const ports = physical.flatMap(group => group.ports.map(port => ({ ...port,
          index: proplex ? group.name.charCodeAt(0) - 65 : port.index,
          label: proplex ? group.name[0] : String(port.index + 1),
          direction: proplex && port.direction === 'Disabled' ? 'Unknown' : port.direction,
        })));
        const result = { ip, checkedAt: now(), responding: !!first, source: 'Art-Net status reply', subnetMask: item.subnetMask,
          name: proplex ? first.description : first?.name || '', description: first?.description || '', report: first?.report || '', firmwareCode: first?.firmwareCode ?? null,
          oemCode: first?.oemCode ?? null, manufacturerCode: first?.manufacturerCode ?? null, mac: first?.mac || '',
          ports, proplex,
          note: proplex ? 'Art-Net discovery does not report this node’s sACN port configuration. Unknown fields require a supported device-status response.' : 'Port data is reported by the node. Unreported fields remain unknown.',
          error: error || (!first ? 'No Art-Net status reply. The node may be unreachable or may not support these queries.' : ''),
        };
        cache.set(ip, result); if (cache.size > 256) cache.delete(cache.keys().next().value);
        resolve(result);
      };
      item.timer = setTimeout(() => item.finish(), waitMs);
    });
    item.promise = promise; pending.set(ip, item);
    Promise.all(queries().map(packet => send(packet, ip))).catch(error => { if (pending.get(ip) === item) item.finish(error.message); });
    return promise;
  }
  function close() { for (const item of pending.values()) item.finish('Receiver stopped.'); }
  return { poll, receive, close };
}
module.exports = { createNodePoller, decodeReply, queries, validTarget };
