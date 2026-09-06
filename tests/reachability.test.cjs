const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReachabilityProbe } = require('../electron/reachability.cjs');

test('pings four times one second apart on macOS and Windows', async () => {
  for (const [platform, expected] of [['darwin', ['-c', '4', '-i', '1', '-W', '1000', '10.0.0.2']], ['win32', ['-n', '4', '-w', '1000', '10.0.0.2']]]) {
    let call;
    const ping = createReachabilityProbe({ platform, run(command, args, options, callback) { call = { command, args, options }; callback(null); } });
    assert.equal(await ping('10.0.0.2'), true);
    assert.equal(call.command, 'ping'); assert.deepEqual(call.args, expected); assert.equal(call.options.timeout, 6500);
  }
});

test('reports unreachable hosts and rejects unsafe targets', async () => {
  const ping = createReachabilityProbe({ run(command, args, options, callback) { callback(new Error('timeout')); } });
  assert.equal(await ping('192.168.1.102'), false);
  await assert.rejects(ping('8.8.8.8'), RangeError);
});
