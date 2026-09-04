const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDeviceInventory } = require('../electron/device-inventory.cjs');
const { startLanServer } = require('../electron/lan-server.cjs');

test('shared inventory persists and deduplicates concurrent client refreshes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-inventory-test-'));
  const file = path.join(dir, 'devices.json');
  let calls = 0, finish;
  const inventory = createDeviceInventory({ file, poll: async ip => { calls++; await new Promise(resolve => { finish = resolve; }); return { ip, responding: true, ports: [] }; } });
  try {
    inventory.add([{ ip: '10.0.26.104', name: 'Stage' }]);
    inventory.add([{ ip: '010.000.026.104', name: 'Duplicate' }]);
    const first = inventory.refresh();
    assert.equal(inventory.refresh(), first);
    await new Promise(resolve => setImmediate(resolve));
    for (let i = 0; i < 10; i++) inventory.snapshot();
    assert.equal(calls, 1); finish(); await first;
    assert.equal(inventory.snapshot().devices.length, 1);
    assert.equal(inventory.snapshot().info['10.0.26.104'].responding, true);
    const restored = createDeviceInventory({ file, poll: async () => {} });
    assert.equal(restored.snapshot().devices[0].name, 'Stage'); restored.close();
    assert.throws(() => inventory.add([{ ip: '8.8.8.8' }]), RangeError);
  } finally { inventory.close(); fs.rmSync(dir, { recursive: true }); }
});

test('server polls without browsers and does not keep stale results after failure', async () => {
  let calls = 0;
  const inventory = createDeviceInventory({ intervalMs: 10, poll: async ip => { calls++; if (calls > 1) throw Error('Offline'); return { ip, responding: true, ports: [{}] }; } });
  try {
    inventory.add([{ ip: '10.0.26.104' }]); await inventory.refresh();
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.ok(calls >= 2);
    assert.equal(inventory.snapshot().info['10.0.26.104'].responding, false);
    assert.deepEqual(inventory.snapshot().info['10.0.26.104'].ports, []);
  } finally { inventory.close(); }
});

test('unreadable saved inventory is preserved rather than overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-inventory-corrupt-'));
  const file = path.join(dir, 'devices.json'); fs.writeFileSync(file, 'not valid JSON');
  const inventory = createDeviceInventory({ file, poll: async () => {} });
  try {
    assert.match(inventory.snapshot().error, /left unchanged/);
    assert.throws(() => inventory.add([{ ip: '10.0.26.104' }]));
    assert.equal(fs.readFileSync(file, 'utf8'), 'not valid JSON');
  } finally { inventory.close(); fs.rmSync(dir, { recursive: true }); }
});

test('two HTTP clients see one shared list and read snapshots without extra node polling', async () => {
  let calls = 0;
  const lan = await startLanServer({ root: path.join(__dirname, '../desktop-web'), preferredPort: 48832, host: '127.0.0.1',
    pollDevice: async ip => { calls++; return { ip, responding: true, ports: [] }; },
    listenerOptions: { ports: { sacn: 0, artnet: 0 }, bindAddress: '127.0.0.1', joinMulticast: false } });
  const post = (body, headers = {}) => fetch(lan.url + '/api/devices', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ ip: '10.0.26.104' }, { Origin: 'https://outside.example' })).status, 403);
    assert.equal((await post({ ip: '127.0.0.1' })).status, 400);
    assert.equal((await post({ ip: '10.0.26.104', name: 'Stage' })).status, 200);
    await new Promise(resolve => setImmediate(resolve));
    const [a,b] = await Promise.all([fetch(lan.url + '/api/devices').then(r=>r.json()), fetch(lan.url + '/api/devices').then(r=>r.json())]);
    assert.deepEqual(a.devices,b.devices); assert.equal(a.devices[0].name,'Stage'); assert.equal(calls,1);
    await fetch(lan.url + '/api/devices/poll?ip=10.0.26.104'); assert.equal(calls,1);
    assert.equal((await fetch(lan.url + '/api/devices/poll?ip=10.0.26.105')).status,404); assert.equal(calls,1);
  } finally { lan.server.closeAllConnections(); await new Promise(resolve => lan.server.close(resolve)); }
});

test('adding a ProPlex immediately fetches its selected protocol before any browser refresh', async () => {
  const { createDevicePoller } = require('../electron/netron-api.cjs');
  const { pollProplex } = require('../electron/proplex-web.cjs');
  const requests = [];
  const status = '<img src="proplex_logo.png"><title>IQ Two 1616 2X</title><script>var node_type="16U16IO";</script><b>Port Routing</b><table>Decimal (0..32767)<tr><td>A</td><td>Output</td><td></td><td>32</td><td></td><td>Off</td></tr></table><b>Protocol</b><td><font>Protocol</font><br>sACN</td>';
  const setup = '<img src="proplex_logo.png"><input name="ArtNetEnabled" type="checkbox" checked><input name="sACNEnabled" type="checkbox" checked>';
  const poller = createDevicePoller({ read: async () => { throw Error('Not NETRON'); }, proplexPoll: ip => pollProplex(ip, { read: async (_, page) => { requests.push(page); return page === '/status.htm' ? status : setup; } }) });
  const inventory = createDeviceInventory({ poll: ip => poller.poll(ip) });
  try {
    inventory.add([{ ip: '10.0.26.104' }]);
    assert.equal(inventory.snapshot().busy, true);
    await inventory.refresh();
    const node = inventory.snapshot().info['10.0.26.104'];
    assert.deepEqual(requests, ['/status.htm', '/protocol_setup.htm']);
    assert.equal(node.ports[0].outputProtocol, 'Art-Net / sACN');
    assert.equal(node.protocolSource, 'protocol_setup.htm');
    assert.equal(node.ports[0].active, null);
  } finally { inventory.close(); }
});

test('layout saves order and deletion across restart, rejects stale edits, and prevents legacy resurrection', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-layout-test-'));
  const file = path.join(dir, 'devices.json');
  const inventory = createDeviceInventory({ file, poll: async ip => ({ ip, responding: true, ports: [] }) });
  const ips = ['10.0.26.104', '10.0.26.105', '10.0.26.108'];
  let restored;
  try {
    inventory.add(ips.map(ip => ({ ip }))); await inventory.refresh();
    assert.throws(() => inventory.layout({ baseOrder: ips, order: [ips[0],ips[0]] }), RangeError);
    assert.throws(() => inventory.layout({ baseOrder: ips, order: ['10.0.26.109'] }), RangeError);
    inventory.layout({ baseOrder: ips, order: [ips[2],ips[0]] });
    assert.deepEqual(inventory.snapshot().devices.map(d=>d.ip), [ips[2],ips[0]]);
    assert.equal(inventory.snapshot().info[ips[1]], undefined);
    assert.throws(() => inventory.layout({ baseOrder: ips, order: [] }), error => error.statusCode === 409);
    restored = createDeviceInventory({ file, poll: async () => {} });
    assert.deepEqual(restored.snapshot().devices.map(d=>d.ip), [ips[2],ips[0]]);
    restored.add([{ ip:ips[1] }], { legacyImport: true });
    assert.equal(restored.snapshot().devices.length,2);
    restored.add([{ ip:ips[1] }]); await restored.refresh();
    assert.equal(restored.snapshot().devices[2].ip,ips[1]);
    restored.layout({ baseOrder: [ips[2],ips[0],ips[1]], order: [] });
    assert.deepEqual(restored.snapshot().devices, []);
  } finally { inventory.close(); restored?.close(); fs.rmSync(dir, { recursive: true }); }
});

test('deleting a node during its poll discards the result and skips later polls', async () => {
  let finish, calls = 0;
  const inventory = createDeviceInventory({ poll: async ip => { calls++; await new Promise(resolve => { finish=resolve; }); return { ip, responding:true, ports:[] }; } });
  try {
    inventory.add([{ ip:'10.0.26.104' }]); const cycle=inventory.refresh();
    await new Promise(resolve => setImmediate(resolve));
    inventory.layout({ baseOrder:['10.0.26.104'], order:[] });
    finish(); await cycle; await inventory.refresh();
    assert.equal(calls,1); assert.deepEqual(inventory.snapshot().info,{});
  } finally { inventory.close(); }
});

test('layout endpoint shares saved ordering and deletion and rejects cross-origin or stale writes', async () => {
  const lan = await startLanServer({ root:path.join(__dirname,'../desktop-web'), preferredPort:48932, host:'127.0.0.1', pollDevice:async ip=>({ip,responding:true,ports:[]}), listenerOptions:{ports:{sacn:0,artnet:0},bindAddress:'127.0.0.1',joinMulticast:false} });
  const post = (route,body,headers={}) => fetch(lan.url+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const ips=['10.0.26.104','10.0.26.105'];
  try {
    await post('/api/devices',{devices:ips.map(ip=>({ip}))});
    assert.equal((await post('/api/devices/layout',{baseOrder:ips,order:[]},{Origin:'https://outside.example'})).status,403);
    assert.equal((await post('/api/devices/layout',{baseOrder:ips,order:[ips[1]]})).status,200);
    const read=await fetch(lan.url+'/api/devices').then(r=>r.json());
    assert.deepEqual(read.devices.map(d=>d.ip),[ips[1]]);
    assert.equal((await post('/api/devices/layout',{baseOrder:ips,order:[]})).status,409);
  } finally { lan.server.closeAllConnections(); await new Promise(resolve=>lan.server.close(resolve)); }
});
