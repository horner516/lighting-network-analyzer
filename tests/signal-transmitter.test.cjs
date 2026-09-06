const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSignalTransmitter, artNetFrame, sacnFrame, validated } = require('../electron/signal-transmitter.cjs');
const { decodeSacn, decodeArtNet } = require('../electron/signal-listener.cjs');

function harness() {
  const sent = [];
  const socket = { bind(port, callback) { callback(); }, setBroadcast() {}, send(packet, port, address, callback) { sent.push({ packet, port, address }); callback?.(); }, close() {} };
  return { sent, transmitter: createSignalTransmitter({ createSocket: () => socket, intervalMs: 100000, cid: Buffer.alloc(16, 7) }) };
}

test('validates protocol, universe, channel and DMX value limits', () => {
  assert.deepEqual(validated({protocol:'sACN',universe:1,channel:512,value:255,priority:175}), {protocol:'sACN',universe:1,channel:512,value:255,priority:175});
  assert.deepEqual(validated({protocol:'Art-Net',universe:0,channel:1,value:0}), {protocol:'Art-Net',universe:0,channel:1,value:0,priority:100});
  for (const input of [{protocol:'bad',universe:1,channel:1,value:1},{protocol:'sACN',universe:0,channel:1,value:1},{protocol:'Art-Net',universe:32768,channel:1,value:1},{protocol:'sACN',universe:1,channel:513,value:1},{protocol:'sACN',universe:1,channel:1,value:256},{protocol:'sACN',universe:1,channel:1,value:1,priority:201}]) assert.throws(() => validated(input), RangeError);
});

test('frames decode as 512-channel sACN and Art-Net DMX', () => {
  const levels = Buffer.alloc(512); levels[0] = 128; levels[511] = 255;
  const sacn = decodeSacn(sacnFrame(123, levels, 4, Buffer.alloc(16, 1), 175));
  assert.equal(sacn.universe,123); assert.equal(sacn.slots,512); assert.equal(sacn.levels[0],128); assert.equal(sacn.levels[511],255); assert.equal(sacn.sourceName,'Lux Link Transmitter'); assert.equal(sacn.priority,175);
  const artnet = decodeArtNet(artNetFrame(12, levels, 5));
  assert.equal(artnet.universe,12); assert.equal(artnet.slots,512); assert.equal(artnet.levels[0],128); assert.equal(artnet.levels[511],255);
});

test('starts stopped, updates one channel or all channels, switches protocols, and stops immediately', () => {
  const { sent, transmitter } = harness();
  try {
    assert.equal(transmitter.snapshot().enabled,false); assert.equal(sent.length,0);
    let state = transmitter.update({protocol:'sACN',universe:20,channel:5,value:200,setChannel:true});
    assert.equal(state.currentValue,200); assert.equal(sent.length,0);
    transmitter.update({enabled:true}); assert.equal(sent.length,1); assert.equal(sent[0].address,'239.255.0.20');
    state = transmitter.update({protocol:'Art-Net',universe:7,channel:5,value:200,setAll:true});
    assert.equal(state.allAtFifty,true); assert.equal(state.currentValue,128); assert.equal(sent.at(-1).address,'255.255.255.255');
    const count = sent.length; transmitter.update({enabled:false}); assert.equal(transmitter.snapshot().enabled,false); assert.equal(sent.length,count);
  } finally { transmitter.close(); }
});
