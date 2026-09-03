const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNodePoller, decodeReply, queries, validTarget } = require('../electron/node-poller.cjs');

function reply({ bind = 1, name = 'Node', description = 'Lighting node', type = 128 } = {}) {
  const b = Buffer.alloc(239); b.write('Art-Net\0'); b.writeUInt16LE(0x2100, 8);
  b.writeUInt16BE(548, 16); b[18] = 1; b[19] = 2; b[23] = 2;
  b.write(name, 26, 18); b.write(description, 44, 64); b.write('#0001 [0000] OK', 108);
  b.writeUInt16BE(1, 172); b[174] = type; b[182] = 128; b[190] = 3;
  b[211] = bind; b[212] = 128; b[213] = 128;
  return b;
}
test('queries are discovery and IP enquiry only, with programming disabled', () => {
  const [poll, ip] = queries();
  assert.equal(poll.readUInt16LE(8), 0x2000);
  assert.equal(ip.readUInt16LE(8), 0xf800);
  assert.equal(ip[14], 0);
  assert.ok(ip.subarray(12).every(v => v === 0));
  assert.ok(validTarget('10.0.26.105')); assert.ok(validTarget('2.1.1.5'));
  for (const ip of ['127.0.0.1', '224.0.0.1', '255.255.255.255', '8.8.8.8', '10.0.26.999', 'localhost', '10.0.26.255']) assert.equal(validTarget(ip), false);
});
test('replies decode port addresses and explicit RDM state; malformed input is rejected', () => {
  const p = decodeReply(reply()).ports[0];
  assert.equal(p.direction, 'OUT'); assert.equal(p.outputAddress, 291);
  assert.equal(p.outputProtocol, 'Art-Net'); assert.equal(p.active, true); assert.equal(p.rdm, false);
  const older = reply().subarray(0, 207); assert.equal(decodeReply(older).ports[0].rdm, null);
  for (let i = 0; i < 207; i++) assert.equal(decodeReply(reply().subarray(0, i)), null);
});
test('ProPlex physical ports exclude secondary bindings and master controls; unavailable sACN config stays unknown', async () => {
  const sent = [];
  const poller = createNodePoller({ send: async (packet, ip) => sent.push({ packet, ip }), waitMs: 15 });
  const pending = poller.poll('10.0.26.105');
  assert.equal(pending, poller.poll('10.0.26.105'));
  for (let i = 0; i < 16; i++) poller.receive(reply({ bind: i + 1, name: `${String.fromCharCode(65 + i)}|IQ Two 1616`, description: 'IQ Two 1616', type: 0 }), { address: '10.0.26.105' });
  poller.receive(reply({ bind: 17, name: 'A.2|IQ Two 1616', description: 'IQ Two 1616' }), { address: '10.0.26.105' });
  poller.receive(reply({ bind: 73, name: 'RTTrPL X-Fade', description: 'IQ Two 1616' }), { address: '10.0.26.105' });
  const data = await pending;
  assert.equal(data.responding, true); assert.equal(data.ports.length, 16);
  assert.equal(data.ports[15].label, 'P'); assert.equal(data.ports[0].direction, 'Unknown');
  assert.equal(data.ports[0].outputAddress, null); assert.equal(data.subnetMask, null);
  assert.equal(data.name, 'IQ Two 1616'); assert.equal(sent.length, 2);
  await poller.poll('10.0.26.105'); assert.equal(sent.length, 2);
  poller.close();
});
test('only queried IPs are accepted; IP enquiry reports mask and missing replies do not invent health', async () => {
  const poller = createNodePoller({ send: async () => {}, waitMs: 10 });
  const pending = poller.poll('10.0.26.105');
  assert.equal(poller.receive(reply(), { address: '10.0.26.106' }), false);
  const b = Buffer.alloc(34); b.write('Art-Net\0'); b.writeUInt16LE(0xf900, 8); b.writeUInt16BE(14, 10);
  Buffer.from([255, 255, 255, 0]).copy(b, 20);
  poller.receive(b, { address: '10.0.26.105' });
  const data = await pending;
  assert.equal(data.responding, false); assert.equal(data.subnetMask, '255.255.255.0'); assert.deepEqual(data.ports, []);
  await assert.rejects(poller.poll('127.0.0.1'), RangeError);
  poller.close();
});
