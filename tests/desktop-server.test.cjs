const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { join } = require('node:path');
const { startLanServer } = require('../electron/lan-server.cjs');
const root = join(__dirname, '..', 'desktop-web');

test('packaged server skips occupied ports and serves dashboard, assets and actual LAN metadata', async () => {
  const occupied = net.createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  let lan;
  try {
    const preferredPort = occupied.address().port;
    lan = await startLanServer({ root, preferredPort, host: '127.0.0.1', listenerOptions: { ports: { sacn: 0, artnet: 0 }, bindAddress: '127.0.0.1', joinMulticast: false } });
    assert.notEqual(lan.port, preferredPort);
    const home = await fetch(lan.url);
    const html = await home.text();
    assert.equal(home.status, 200);
    assert.match(html, /Lighting Network Analyzer/);
    const script = html.match(/src="([^"]+\.js)"/)[1];
    assert.equal((await fetch(lan.url + script)).status, 200);
    const info = await fetch(lan.url + '/api/server-info').then(res => res.json());
    assert.deepEqual(info, { port: lan.port, urls: [lan.url] });
    const signals = await fetch(lan.url + '/api/signals').then(res => res.json());
    assert.equal(signals.available, true);
    assert.equal(signals.protocols.sACN.status, 'listening');
    assert.deepEqual(signals.signals, []);
    const channelUrl = lan.url + '/api/signals/channel?protocol=Art-Net&universe=0&channel=512';
    const channelReading = await fetch(channelUrl).then(res => res.json());
    assert.equal(channelReading.channel, 512);
    assert.deepEqual(channelReading.streams, []);
    assert.equal((await fetch(channelUrl, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(lan.url + '/api/signals/channel?protocol=sACN&universe=0&channel=1')).status, 400);
    assert.equal((await fetch(lan.url + '/api/signals/channel?protocol=Art-Net&channel=1')).status, 400);
    assert.equal((await fetch(lan.url + '/api/devices/poll?ip=127.0.0.1')).status, 400);
    assert.equal((await fetch(lan.url + '/api/devices/poll?ip=10.0.26.105', { headers: { Origin: 'https://other.example' } })).status, 403);
    assert.equal((await fetch(lan.url + '/package.json')).status, 404);
    assert.equal((await fetch(lan.url + '/..%2fpackage.json')).status, 403);
    assert.equal((await fetch(lan.url + '/', { method: 'POST' })).status, 405);
    assert.equal((await fetch(lan.url + '/', { method: 'HEAD' })).status, 200);
  } finally {
    if (lan) { lan.server.closeAllConnections(); await new Promise(resolve => lan.server.close(resolve)); }
    await new Promise(resolve => occupied.close(resolve));
  }
});

test('invalid ports and missing bundled content produce clear startup errors', async () => {
  await assert.rejects(startLanServer({ root, preferredPort: NaN }), /port must/);
  await assert.rejects(startLanServer({ root: join(root, 'not-present') }), /bundled dashboard is missing/);
});
