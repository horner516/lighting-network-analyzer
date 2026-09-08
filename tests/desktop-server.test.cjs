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
    lan = await startLanServer({ root, preferredPort, host: '127.0.0.1', releaseRequest: async () => Response.json({tag_name:'v99.0.0'}), listenerOptions: { ports: { sacn: 0, artnet: 0 }, bindAddress: '127.0.0.1', joinMulticast: false } });
    assert.notEqual(lan.port, preferredPort);
    const home = await fetch(lan.url);
    const html = await home.text();
    assert.equal(home.status, 200);
    assert.match(html, /Lux Link/);
    const script = html.match(/src="([^"]+\.js)"/)[1];
    assert.equal((await fetch(lan.url + script)).status, 200);
    const info = await fetch(lan.url + '/api/server-info').then(res => res.json());
    assert.deepEqual(info, { port: lan.port, urls: [lan.url] });
    const update = await fetch(lan.url + '/api/updates').then(res => res.json());
    assert.equal(update.currentVersion, require('../package.json').version);
    assert.equal(update.newer, true);
    assert.equal((await fetch(lan.url + '/api/updates', {headers:{Origin:'https://other.example'}})).status,403);
    const signals = await fetch(lan.url + '/api/signals').then(res => res.json());
    assert.equal(signals.available, true);
    assert.equal(signals.protocols.sACN.status, 'listening');
    assert.deepEqual(signals.signals, []);
    const transmitter = await fetch(lan.url + '/api/transmitter').then(res => res.json());
    assert.equal(transmitter.available, true); assert.equal(transmitter.enabled, false);
    const network = await fetch(lan.url + '/api/network-interface').then(res => res.json());
    assert.equal(network.available, true); assert.equal(network.selected, ''); assert.ok(Array.isArray(network.interfaces));
    assert.equal((await fetch(lan.url + '/api/network-interface', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({address:'192.0.2.99'}) })).status, 400);
    const configured = await fetch(lan.url + '/api/transmitter', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({protocol:'sACN',universe:22,channel:7,value:99,setChannel:true}) }).then(res => res.json());
    assert.equal(configured.enabled, false); assert.equal(configured.currentValue, 99); assert.equal(configured.universe, 22);
    assert.equal((await fetch(lan.url + '/api/transmitter', { method:'POST', headers:{Origin:'https://other.example','Content-Type':'application/json'}, body:'{}' })).status,403);
    const channelUrl = lan.url + '/api/signals/channel?protocol=Art-Net&universe=0&channel=512';
    const channelReading = await fetch(channelUrl).then(res => res.json());
    assert.equal(channelReading.channel, 512);
    assert.deepEqual(channelReading.streams, []);
    assert.equal((await fetch(channelUrl, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(lan.url + '/api/signals/channel?protocol=sACN&universe=0&channel=1')).status, 400);
    assert.equal((await fetch(lan.url + '/api/signals/channel?protocol=Art-Net&channel=1')).status, 400);
    const rangeUrl = lan.url + '/api/signals/channels?protocol=Art-Net&universe=0&start=497&count=16';
    const rangeReading = await fetch(rangeUrl).then(res => res.json());
    assert.equal(rangeReading.start, 497); assert.equal(rangeReading.end, 512);
    assert.equal((await fetch(lan.url + '/api/signals/channels?protocol=sACN&universe=1&start=500&count=16')).status, 400);
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

test('LAN server binds all IPv4 interfaces and advertises non-loopback addresses', async () => {
  const { networkInterfaces } = require('node:os');
  const ips = [...new Set(Object.values(networkInterfaces()).flat().filter(item => item && !item.internal && item.family === 'IPv4').map(item => item.address))];
  const lan = await startLanServer({ root, preferredPort: 48732, listenerOptions: { ports: { sacn: 0, artnet: 0 }, bindAddress: '127.0.0.1', joinMulticast: false } });
  try {
    assert.equal(lan.server.address().address, '0.0.0.0');
    assert.deepEqual(lan.info().urls, ips.map(ip => `http://${ip}:${lan.port}`));
    assert.equal((await fetch(lan.url)).status, 200);
  } finally { lan.server.closeAllConnections(); await new Promise(resolve => lan.server.close(resolve)); }
});

test('LAN server preserves Console type when polling newly added devices', async () => {
  let observedOptions;
  const consoleInfo = { ip:'192.168.1.5', checkedAt:Date.now(), responding:true, online:true, consoleBrand:'ETC', consoleFamily:'Eos Family', consoleServicePort:3032, ports:[] };
  const lan = await startLanServer({ root, host:'127.0.0.1', preferredPort:48782,
    devicePollerFactory:() => ({ poll:async (ip, options) => { observedOptions = options; return { ...consoleInfo, ip }; }, updatePortUniverses:async()=>{} }),
    listenerOptions:{ports:{sacn:0,artnet:0},bindAddress:'127.0.0.1',joinMulticast:false} });
  try {
    await fetch(lan.url+'/api/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:'192.168.1.5',deviceType:'Console'})});
    let snapshot;
    for (let attempt = 0; attempt < 20; attempt++) {
      snapshot = await fetch(lan.url+'/api/devices').then(response => response.json());
      if (snapshot.info['192.168.1.5']) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.deepEqual(observedOptions, { deviceType:'Console' });
    assert.equal(snapshot.info['192.168.1.5'].consoleBrand, 'ETC');
  } finally { lan.server.closeAllConnections(); await new Promise(resolve => lan.server.close(resolve)); }
});

test('configured nodes can update output universes through the guarded server endpoint', async () => {
  let request;
  const node = { ip:'10.0.26.105', checkedAt:Date.now(), responding:true, online:true, source:'ProPlex web monitor', name:'Test', description:'IQ Two', proplex:true, universeEditing:'proplex-web', ports:[], subnetMask:null, firmwareCode:null, mac:'', report:'', note:'', error:'' };
  const lan = await startLanServer({ root, host:'127.0.0.1', preferredPort:48832, pollDevice:async()=>node,
    updatePortUniverses:async (ip, updates) => { request={ip,updates}; return node; }, listenerOptions:{ports:{sacn:0,artnet:0},bindAddress:'127.0.0.1',joinMulticast:false} });
  try {
    await fetch(lan.url+'/api/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:'10.0.26.105',deviceType:'Node'})});
    const response = await fetch(lan.url+'/api/devices/ports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:'10.0.26.105',updates:[{index:14,universe:55},{index:15,universe:56}]})});
    assert.equal(response.status,200); assert.deepEqual(request,{ip:'10.0.26.105',updates:[{index:14,universe:55},{index:15,universe:56}]});
    assert.equal((await response.json()).info['10.0.26.105'].universeEditing,'proplex-web');
    assert.equal((await fetch(lan.url+'/api/devices/ports',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
  } finally { lan.server.closeAllConnections(); await new Promise(resolve => lan.server.close(resolve)); }
});

test('discovery endpoint is same-origin, server-owned and passes configured devices', async () => {
  let request;
  const lan = await startLanServer({ root, host:'127.0.0.1', preferredPort:48842,
    discoveryFactory:() => ({ scan:async options => { request=options; return {scannedAt:1,interface:options.address,deep:options.deep,results:[]}; } }),
    listenerOptions:{ports:{sacn:0,artnet:0},bindAddress:'127.0.0.1',joinMulticast:false} });
  try {
    await fetch(lan.url+'/api/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:'192.168.1.101',deviceType:'Node'})});
    const response = await fetch(lan.url+'/api/discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:'',deep:false})});
    assert.equal(response.status,200);
    assert.deepEqual(request,{address:'',deep:false,configured:['192.168.1.101']});
    assert.equal((await fetch(lan.url+'/api/discovery',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
  } finally { lan.server.closeAllConnections(); await new Promise(resolve => lan.server.close(resolve)); }
});
