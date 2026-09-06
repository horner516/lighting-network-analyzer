const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { pollMaConsole, readWebRemoteMetadata } = require('../electron/ma-console.cjs');

test('recognizes MA Web Remote and attaches screen-reader metadata', async () => {
  const original = http.get;
  http.get = (options, callback) => {
    assert.equal(options.port, 8080); assert.equal(options.path, '/');
    const response = new (require('node:events').EventEmitter)(); response.statusCode = 200;
    const request = new (require('node:events').EventEmitter)(); request.destroy = error => request.emit('error', error);
    queueMicrotask(() => { callback(response); response.emit('data', Buffer.from('<title>MA Webremote</title>')); response.emit('end'); request.emit('close'); });
    return request;
  };
  try {
    const result = await pollMaConsole('192.168.1.11', { metadata: async () => ({ sessionName: 'LITE_4', showFile: 'Exe summit patch', sessionStatus: 'IdleMaster' }) });
    assert.equal(result.responding, true); assert.equal(result.source, 'MA Web Remote');
    assert.equal(result.sessionName, 'LITE_4'); assert.equal(result.showFile, 'Exe summit patch'); assert.equal(result.sessionStatus, 'IdleMaster'); assert.deepEqual(result.ports, []);
  } finally { http.get = original; }
});

test('metadata helper output is bounded and invalid output fails closed', async () => {
  const ok = await readWebRemoteMetadata('192.168.1.11', { helper: '/reader', run(file, args, options, callback) {
    assert.equal(file, '/reader'); assert.deepEqual(args, ['192.168.1.11']); assert.equal(options.timeout, 12000);
    callback(null, JSON.stringify({ sessionName: 'LITE_4', showFile: 'Exe summit patch', sessionStatus: 'IdleMaster' }));
  }});
  assert.equal(ok.sessionName, 'LITE_4'); assert.equal(ok.showFile, 'Exe summit patch');
  const bad = await readWebRemoteMetadata('192.168.1.11', { helper: '/reader', run(file, args, options, callback) { callback(null, 'not-json'); } });
  assert.match(bad.error, /invalid response/);
});
