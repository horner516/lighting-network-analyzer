const test = require('node:test');
const assert = require('node:assert/strict');
const { broadcastAddress, subnet24, createDeviceDiscovery } = require('../electron/device-discovery.cjs');

test('calculates directed broadcast and bounded /24 hosts', () => {
  assert.equal(broadcastAddress('192.168.1.17','255.255.255.0'),'192.168.1.255');
  assert.equal(subnet24('10.0.26.7').length,254);
  assert.equal(subnet24('10.0.26.7')[0],'10.0.26.1');
});

test('merges Art-Net and observed sources and verifies device identity', async () => {
  const discovery = createDeviceDiscovery({
    interfaces:()=>[{name:'Ethernet',address:'192.168.1.20',netmask:'255.255.255.0'}],
    artDiscover:async targets => { assert.deepEqual(targets,['192.168.1.255','255.255.255.255']); return [{ip:'192.168.1.101',description:'IQ Two 1616 2X',proplex:true}]; },
    signalSnapshot:()=>({signals:[{ip:'192.168.1.11',protocol:'sACN',sourceName:'grandMA3'}]}),
    pollDevice:async ip => ip.endsWith('.11') ? {responding:true,consoleBrand:'MA Lighting',name:'grandMA',description:'grandMA console'} : {responding:true,proplex:true,name:'Z1,1',description:'IQ Two 1616 2X',source:'ProPlex web monitor'},
  });
  const result = await discovery.scan({address:'192.168.1.20',configured:['192.168.1.101']});
  assert.equal(result.results.length,2);
  assert.equal(result.results[0].brand,'MA Lighting');
  assert.equal(result.results[1].alreadyAdded,true);
});
