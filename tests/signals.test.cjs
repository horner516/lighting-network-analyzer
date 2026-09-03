const { test } = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const { createSignalListener, decodeSacn, decodeArtNet, parseUniverses } = require('../electron/signal-listener.cjs');

function sacn({ universe = 51, cid = 1, options = 0, startCode = 0, slots = 4 } = {}) {
  const b = Buffer.alloc(126 + slots);
  b.writeUInt16BE(16, 0); b.write('ASC-E1.17\0\0\0', 4);
  b.writeUInt16BE(0x7000 | (b.length - 16), 16); b.writeUInt32BE(4, 18); b[22] = cid;
  b.writeUInt16BE(0x7000 | (b.length - 38), 38); b.writeUInt32BE(2, 40); b.write('Loopback test only', 44);
  b[108] = 100; b[111] = 7; b[112] = options; b.writeUInt16BE(universe, 113);
  b.writeUInt16BE(0x7000 | (b.length - 115), 115); b[117] = 2; b[118] = 0xa1;
  b.writeUInt16BE(1, 121); b.writeUInt16BE(slots + 1, 123); b[125] = startCode; b[126] = 255;
  return b;
}
function artnet(universe = 0) {
  const b = Buffer.alloc(22); b.write('Art-Net\0'); b.writeUInt16LE(0x5000, 8); b.writeUInt16BE(14, 10);
  b.writeUInt16LE(universe, 14); b.writeUInt16BE(4, 16); b[18] = 127;
  return b;
}
const opts = { ports: { sacn: 0, artnet: 0 }, bindAddress: '127.0.0.1', joinMulticast: false };
test('decoders validate framing, lengths, universes and levels; random input never throws', () => {
  assert.equal(decodeSacn(sacn()).universe, 51);
  assert.equal(decodeSacn(sacn()).levels[0], 255);
  assert.equal(decodeArtNet(artnet()).universe, 0);
  assert.equal(decodeArtNet(artnet(32767)).universe, 32767);
  assert.equal(decodeSacn(sacn({ universe: 0 })), null);
  assert.equal(decodeArtNet(artnet(32768)), null);
  const malformed = sacn(); malformed[117] = 9; assert.equal(decodeSacn(malformed), null);
  const poll = artnet(); poll.writeUInt16LE(0x2100, 8); assert.equal(decodeArtNet(poll), null);
  for (let i = 0; i < 700; i++) { assert.doesNotThrow(() => decodeSacn(Buffer.alloc(i))); assert.doesNotThrow(() => decodeArtNet(Buffer.alloc(i))); }
  for (let i = 0; i < 130; i++) assert.equal(decodeSacn(sacn().subarray(0, i)), null);
});
test('universe selection is bounded and deterministic', () => {
  assert.deepEqual(parseUniverses('1-3,51,3'), [1, 2, 3, 51]);
  for (const value of ['0', '64000', '3-1', '1-257', 'x', '1,']) assert.throws(() => parseUniverses(value));
});
test('streams are grouped, expire, recover and terminate without inventing health', async () => {
  let time = 10000;
  const listener = createSignalListener({ ...opts, now: () => time });
  await listener.ready;
  try {
    const remote = { address: '127.0.0.1' };
    listener.ingest('sACN', sacn(), remote);
    listener.ingest('sACN', sacn({ cid: 2 }), remote);
    listener.ingest('sACN', sacn({ options: 0x80, universe: 12 }), remote);
    listener.ingest('sACN', sacn({ startCode: 0xdd, universe: 13 }), remote);
    listener.ingest('Art-Net', artnet(), remote);
    assert.equal(listener.snapshot().signals.length, 3);
    assert.ok(listener.snapshot().signals.every(s => s.status === 'present'));
    assert.equal(listener.snapshot().signals.find(s => s.protocol === 'sACN').nonzero, 1);
    time += 3001;
    assert.ok(listener.snapshot().signals.every(s => s.status === 'timed-out' && s.rate === 0));
    listener.ingest('sACN', sacn(), remote);
    assert.equal(listener.snapshot().signals.filter(s => s.status === 'present').length, 1);
    listener.ingest('sACN', sacn({ options: 0x40 }), remote);
    assert.equal(listener.snapshot().signals.filter(s => s.status === 'terminated').length, 1);
    time += 300001; assert.equal(listener.snapshot().signals.length, 0);
  } finally { listener.close(); }
});
test('real UDP reception on loopback; occupied Art-Net port produces an error', async () => {
  const listener = createSignalListener(opts); await listener.ready;
  const sender = dgram.createSocket('udp4');
  let conflict;
  try {
    const ports = listener.snapshot().protocols;
    await Promise.all([new Promise((resolve, reject) => sender.send(sacn(), ports.sACN.port, '127.0.0.1', e => e ? reject(e) : resolve())), new Promise((resolve, reject) => sender.send(artnet(12), ports['Art-Net'].port, '127.0.0.1', e => e ? reject(e) : resolve()))]);
    const deadline = Date.now() + 2000;
    while (listener.snapshot().signals.length < 2 && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
    assert.equal(listener.snapshot().signals.length, 2);
    conflict = createSignalListener({ ...opts, ports: { sacn: 0, artnet: ports['Art-Net'].port } });
    await conflict.ready;
    assert.equal(conflict.snapshot().protocols['Art-Net'].status, 'error');
    assert.match(conflict.snapshot().protocols['Art-Net'].error, /EADDRINUSE/);
  } finally { sender.close(); listener.close(); conflict?.close(); }
});
test('invalid configuration is visible, not a startup crash', async () => {
  const listener = createSignalListener({ ...opts, universeSpec: '0' }); await listener.ready;
  assert.equal(listener.snapshot().protocols.sACN.status, 'error'); listener.close();
});
test('channel readings preserve source identity, zero, channel 512, missing slots and stale state', async () => {
  let time = 10000;
  const listener = createSignalListener({ ...opts, now: () => time }); await listener.ready;
  try {
    const remote = { address: '127.0.0.1' };
    const full = sacn({ slots: 512 }); full[637] = 201;
    listener.ingest('sACN', full, remote);
    listener.ingest('sACN', sacn({ cid: 2 }), remote);
    assert.deepEqual(listener.channelValue('sACN', 51, 512).streams.map(s => s.value), [201, null]);
    assert.deepEqual(listener.channelValue('sACN', 51, 2).streams.map(s => s.value), [0, 0]);
    assert.equal(new Set(listener.channelValue('sACN', 51, 1).streams.map(s => s.id)).size, 2);
    listener.ingest('Art-Net', artnet(), remote);
    assert.equal(listener.channelValue('Art-Net', 0, 1).streams[0].value, 127);
    assert.equal(listener.channelValue('sACN', 65, 1).subscribed, false);
    assert.deepEqual(listener.channelValue('sACN', 65, 1).streams, []);
    for (const args of [['bad', 1, 1], ['sACN', 0, 1], ['sACN', 64000, 1], ['Art-Net', 32768, 1], ['sACN', 1, 0], ['sACN', 1, 513], ['sACN', 1, 1.5]]) assert.throws(() => listener.channelValue(...args), RangeError);
    time += 3001;
    assert.ok(listener.channelValue('sACN', 51, 512).streams.every(s => s.value === null && s.status === 'timed-out'));
    listener.ingest('sACN', full, remote);
    assert.equal(listener.channelValue('sACN', 51, 512).streams[0].value, 201);
    listener.ingest('sACN', sacn({ options: 0x40 }), remote);
    assert.equal(listener.channelValue('sACN', 51, 512).streams[0].value, null);
  } finally { listener.close(); }
});
test('peak rates are server-owned, per protocol, retained after idle and reset on restart', async () => {
  let time = 10000;
  const listener = createSignalListener({ ...opts, now: () => time }); await listener.ready;
  try {
    const remote = { address: '127.0.0.1' };
    for (let i = 0; i < 50; i++) listener.ingest('Art-Net', artnet(), remote);
    for (let i = 0; i < 25; i++) { const frame = sacn(); frame[111] = i; listener.ingest('sACN', frame, remote); }
    assert.equal(listener.snapshot().protocols['Art-Net'].peakRate, 10);
    assert.equal(listener.snapshot().protocols.sACN.peakRate, 5);
    time += 10000;
    listener.ingest('Art-Net', artnet(), remote);
    assert.equal(listener.snapshot().protocols['Art-Net'].peakRate, 10);
    for (let i = 0; i < 99; i++) listener.ingest('Art-Net', artnet(), remote);
    assert.equal(listener.snapshot().protocols['Art-Net'].peakRate, 20);
  } finally { listener.close(); }
  const restarted = createSignalListener(opts); await restarted.ready;
  assert.equal(restarted.snapshot().protocols['Art-Net'].peakRate, 0); restarted.close();
});
