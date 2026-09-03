const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProplex, readStatus } = require('../electron/proplex-web.cjs');
const { createDevicePoller } = require('../electron/netron-api.cjs');
function fixture(type = '16U16IO') {
  const field = (name, value) => `<td><font size="2">${name}</font><br>${value}</td>`;
  return `<title>IQ Two 1616</title><img src="proplex_logo.png"><script>var node_type = "${type}";</script>
    <b>Node Name</b><hr/> Test &amp; node </td>${field('Subnet Mask','255.0.0.0')}${field('MAC Address','00:11:22:33:44:55')}
    <b>Port Routing</b><table><tr><td>Decimal (0..32767)</td></tr>
    ${Array.from({length:16}, (_,i)=>`<tr><td>${String.fromCharCode(65+i)}</td><td>${i===1?'Input':'Output'}</td><td></td><td>${i===11?0:32+i}</td><td></td><td>${i===0?'On':'Off'}</td><td></td><td>100</td></tr>`).join('')}</table>
    <b>Protocol</b>${field('Protocol','sACN')}${field('DMX Rate','30Hz')}${field('Master','Version 2.36')}`;
}
test('reads ProPlex web status without treating configuration as signal or health', () => {
  const d = normalizeProplex('10.0.26.106', fixture());
  assert.equal(d.ports.length,16); assert.equal(d.subnetMask,'255.0.0.0');
  assert.equal(d.name,'Test & node'); assert.equal(d.firmware,'Version 2.36');
  assert.equal(d.ports[0].outputAddress,32); assert.equal(d.ports[0].outputProtocol,'sACN');
  assert.equal(d.ports[0].rdm,true); assert.equal(d.ports[1].rdm,false);
  assert.equal(d.ports[1].inputAddress,33); assert.equal(d.ports[1].outputAddress,null);
  assert.equal(d.ports[0].active,null); assert.equal(d.ports[0].frameRate,30);
  assert.equal(d.ports[11].displayUniverse,0); assert.equal(d.ports[11].outputAddress,null);
  assert.match(d.ports[11].error,/outside/);
});
test('respects physical model counts, rejects other pages, and never guesses nondecimal universes', () => {
  for (const [type,count] of [['6U6IO',6],['8U8IO',8],['16U16IO',16],['4U16IO',4]]) assert.equal(normalizeProplex('10.0.26.106',fixture(type)).ports.length,count);
  assert.throws(()=>normalizeProplex('10.0.26.106','<title>Another device</title>'));
  assert.throws(()=>normalizeProplex('10.0.26.106',fixture('unrecognized')));
  const d=normalizeProplex('10.0.26.106',fixture().replace('Decimal (0..32767)','Hex (0..F)'));
  assert.equal(d.ports[0].displayUniverse,null); assert.match(d.error,/unsupported/);
});
test('missing port fields and unsupported protocol remain unknown', () => {
  const d=normalizeProplex('10.0.26.106',fixture().replace('<td>On</td>','<td></td>').replace('>sACN<','>Other<'));
  assert.equal(d.ports[0].rdm,null); assert.equal(d.ports[0].outputProtocol,null);
  assert.equal(d.ports[0].outputAddress,null); assert.match(d.error,/Protocol/);
});
test('poller prefers ProPlex web status and degrades to explicit Art-Net fallback', async () => {
  const expected=normalizeProplex('10.0.26.106',fixture());
  const p=createDevicePoller({read:async()=>{throw Error('Not NETRON');},proplexPoll:async()=>expected,artnetPoll:async()=>{throw Error('Should not poll Art-Net');}});
  assert.equal(await p.poll('10.0.26.106'),expected);
  const fallback=createDevicePoller({read:async()=>({}),proplexPoll:async()=>{throw Error('Timeout');},artnetPoll:async()=>({proplex:true,ports:[],source:'Art-Net'})});
  assert.match((await fallback.poll('10.0.26.106')).error,/web status unavailable/);
  await assert.rejects(readStatus('127.0.0.1'),RangeError);
});
