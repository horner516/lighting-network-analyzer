const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNetron, createDevicePoller, readJson } = require('../electron/netron-api.cjs');
const settings = { DeviceType: 'NETRON EN12', DeviceName: 'Test node', GlobalRDMmode: 1, UniverseMode: 0 };
const port = { ptMode: 2, ptProtocol: 1, ptUniverse: 44, ptRDM: 1, ptFramerate: 5, ptMergeMode: 0, ptRangeFrom: 1, ptRangeTo: 512 };
test('maps actual API fields without inferring signal presence; preserves universe numbering', () => {
  const data = normalizeNetron('10.0.26.108', settings, { FirmwareVer: 'V2.9.2', OnTime: '1969h' }, { ipaddress: '010.000.026.108', netmask: '255.000.000.000' }, [port, { ...port, ptProtocol: 0, ptUniverse: 5 }]);
  assert.equal(data.reportedIp, '10.0.26.108'); assert.equal(data.subnetMask, '255.0.0.0');
  assert.equal(data.firmware, 'V2.9.2'); assert.equal(data.ports[0].outputAddress, 44);
  assert.equal(data.ports[0].displayUniverse, 44); assert.equal(data.ports[0].rdm, true);
  assert.equal(data.ports[0].frameRate, 35); assert.equal(data.ports[0].active, null);
  assert.equal(data.ports[1].outputAddress, 5); assert.equal(data.ports[1].displayUniverse, 6);
});
test('global RDM off overrides port settings; disabled, send-value and unknown fields remain accurate', () => {
  const d = normalizeNetron('10.0.26.108', { ...settings, GlobalRDMmode: 0 }, null, null, [port, { ...port, ptMode: 0 }, { ...port, ptMode: 3 }, {}]);
  assert.equal(d.ports[0].rdm, false); assert.equal(d.ports[1].outputAddress, null);
  assert.equal(d.ports[2].outputProtocol, null); assert.equal(d.ports[3].direction, 'Unknown');
  assert.equal(d.ports[3].rdm, null); assert.equal(d.subnetMask, null);
  assert.throws(() => normalizeNetron('10.0.26.108', {}, {}, {}, []));
});
test('reads only known status resources, caches polls, and retains identity on partial failure', async () => {
  const calls = [];
  const poller = createDevicePoller({ artnetPoll: async () => { throw Error('Unexpected fallback'); }, read: async (ip, path) => {
    calls.push(path);
    if (path === '/Setting.json') return settings;
    if (path === '/DMXPorts.json') return [port];
    throw Error('Unavailable');
  }});
  const [a, b] = await Promise.all([poller.poll('10.0.26.108'), poller.poll('10.0.26.108')]);
  assert.equal(a, b); assert.equal(a.responding, true); assert.equal(a.ports.length, 1);
  assert.match(a.error, /Network settings unavailable/);
  await poller.poll('10.0.26.108'); assert.equal(calls.length, 4);
  assert.deepEqual(calls, ['/Setting.json', '/index.json', '/IP.json', '/DMXPorts.json']);
});
test('unsupported devices report unavailable without Art-Net discovery; invalid targets are rejected', async () => {
  const poller = createDevicePoller({ read: async () => ({}), proplexPoll: async () => { throw Error('Not ProPlex'); }, artnetPoll: async () => { throw Error('Art-Net must not be queried'); } });
  const d = await poller.poll('10.0.26.105');
  assert.equal(d.responding, false); assert.deepEqual(d.ports, []); assert.match(d.error, /web\/API polling failed/);
  await assert.rejects(poller.poll('127.0.0.1'), RangeError);
  await assert.rejects(readJson('10.0.26.108', '/write'), /Unsupported/);
});
