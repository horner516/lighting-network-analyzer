const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { pollMaConsole } = require('../electron/ma-console.cjs');

test('recognizes MA Web Remote without claiming proprietary session state', async () => {
  const original = http.get;
  http.get = (options, callback) => {
    assert.equal(options.port, 8080); assert.equal(options.path, '/');
    const response = new (require('node:events').EventEmitter)(); response.statusCode = 200;
    const request = new (require('node:events').EventEmitter)(); request.destroy = error => request.emit('error', error);
    queueMicrotask(() => { callback(response); response.emit('data', Buffer.from('<title>MA Webremote</title>')); response.emit('end'); request.emit('close'); });
    return request;
  };
  try {
    const result = await pollMaConsole('192.168.1.11');
    assert.equal(result.responding, true); assert.equal(result.source, 'MA Web Remote');
    assert.match(result.note, /Session name is not exposed/); assert.deepEqual(result.ports, []);
  } finally { http.get = original; }
});
