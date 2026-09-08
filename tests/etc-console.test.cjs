const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { pollEtcConsole, probeTcp } = require('../electron/etc-console.cjs');

test('detects ETC Eos by its documented OSC service without sending data', async () => {
  const checked = [];
  const result = await pollEtcConsole('192.168.1.5', { probe: async (_ip, port) => { checked.push(port); return port === 3032; }, now: () => 1234 });
  assert.deepEqual(checked, [3032]);
  assert.equal(result.consoleBrand, 'ETC');
  assert.equal(result.consoleFamily, 'Eos Family');
  assert.equal(result.consoleServicePort, 3032);
  assert.equal(result.checkedAt, 1234);
  assert.match(result.metadataStatus, /MA Web Remote is not used/);
});

test('falls back to the optional ETC Third Party OSC port', async () => {
  const result = await pollEtcConsole('192.168.1.6', { probe: async (_ip, port) => port === 3037 });
  assert.equal(result.consoleServicePort, 3037);
});

test('TCP fingerprint probe opens and closes without writing', async () => {
  let destroyed = false, wrote = false;
  const open = await probeTcp('192.168.1.5', 3032, { connect(options) {
    assert.deepEqual(options, { host: '192.168.1.5', port: 3032 });
    const socket = new EventEmitter();
    socket.setTimeout = () => {}; socket.destroy = () => { destroyed = true; }; socket.write = () => { wrote = true; };
    queueMicrotask(() => socket.emit('connect'));
    return socket;
  }});
  assert.equal(open, true); assert.equal(destroyed, true); assert.equal(wrote, false);
});
