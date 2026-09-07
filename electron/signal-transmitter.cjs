const dgram = require('node:dgram');
const crypto = require('node:crypto');

const ACN_ID = Buffer.from('ASC-E1.17\0\0\0');

function validated(input = {}) {
  const protocol = input.protocol;
  if (!['sACN', 'Art-Net'].includes(protocol)) throw new RangeError('Choose sACN or Art-Net.');
  const universe = Number(input.universe), channel = Number(input.channel), value = Number(input.value);
  const maximumUniverse = protocol === 'sACN' ? 63999 : 32767;
  if (!Number.isInteger(universe) || universe < (protocol === 'sACN' ? 1 : 0) || universe > maximumUniverse) throw new RangeError(`Choose a ${protocol} universe from ${protocol === 'sACN' ? 1 : 0} to ${maximumUniverse}.`);
  if (!Number.isInteger(channel) || channel < 1 || channel > 512) throw new RangeError('Choose a channel from 1 to 512.');
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError('Choose a DMX value from 0 to 255.');
  const priority = Number(input.priority ?? 100);
  if (!Number.isInteger(priority) || priority < 0 || priority > 200) throw new RangeError('Choose an sACN priority from 0 to 200.');
  return { protocol, universe, channel, value, priority };
}

function artNetFrame(universe, levels, sequence) {
  const packet = Buffer.alloc(18 + 512);
  packet.write('Art-Net\0'); packet.writeUInt16LE(0x5000, 8); packet.writeUInt16BE(14, 10);
  packet[12] = sequence; packet.writeUInt16LE(universe, 14); packet.writeUInt16BE(512, 16); levels.copy(packet, 18);
  return packet;
}

function sacnFrame(universe, levels, sequence, cid, priority = 100, options = 0) {
  const packet = Buffer.alloc(638);
  packet.writeUInt16BE(16, 0); ACN_ID.copy(packet, 4); packet.writeUInt16BE(0x726e, 16); packet.writeUInt32BE(4, 18); cid.copy(packet, 22);
  packet.writeUInt16BE(0x7258, 38); packet.writeUInt32BE(2, 40); packet.write('Lux Link Transmitter', 44, 'utf8'); packet[108] = priority; packet[111] = sequence; packet[112] = options; packet.writeUInt16BE(universe, 113);
  packet.writeUInt16BE(0x720b, 115); packet[117] = 2; packet[118] = 0xa1; packet.writeUInt16BE(1, 121); packet.writeUInt16BE(513, 123); levels.copy(packet, 126);
  return packet;
}

function createSignalTransmitter({ createSocket = type => dgram.createSocket(type), intervalMs = 33, cid = crypto.randomBytes(16), interfaceIp = '' } = {}) {
  const socket = createSocket('udp4'); socket.bind(interfaceIp ? { port: 0, address: interfaceIp } : 0, () => { socket.setBroadcast(true); if (interfaceIp) socket.setMulticastInterface?.(interfaceIp); });
  const levels = Buffer.alloc(512); let enabled = false, sequence = 0, timer = null;
  let config = { protocol: 'sACN', universe: 1, channel: 1, value: 0, priority: 100 };
  function send() {
    if (!enabled) return;
    sequence = sequence >= 255 ? 1 : sequence + 1;
    const packet = config.protocol === 'sACN' ? sacnFrame(config.universe, levels, sequence, cid, config.priority) : artNetFrame(config.universe, levels, sequence);
    const address = config.protocol === 'sACN' ? `239.255.${config.universe >> 8}.${config.universe & 255}` : '255.255.255.255';
    socket.send(packet, config.protocol === 'sACN' ? 5568 : 6454, address, () => {});
  }
  function update(input = {}) {
    const next = validated({ ...config, ...input });
    if (input.setAll === true) levels.fill(128);
    else if (input.setChannel === true) levels[next.channel - 1] = next.value;
    config = next;
    if (typeof input.enabled === 'boolean') enabled = input.enabled;
    clearInterval(timer); timer = enabled ? setInterval(send, intervalMs) : null; timer?.unref?.();
    if (enabled) send();
    return snapshot();
  }
  function snapshot() { return { available: true, enabled, interfaceIp, ...config, currentValue: levels[config.channel - 1], allAtFifty: levels.every(value => value === 128), frameRate: Math.round(1000 / intervalMs) }; }
  function close() { enabled = false; clearInterval(timer); socket.close(); }
  return { update, snapshot, close };
}

module.exports = { createSignalTransmitter, artNetFrame, sacnFrame, validated };
