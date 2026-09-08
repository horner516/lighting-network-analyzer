const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseMvr, parseAddress, groupFixtures } = require('../electron/mvr-fixtures.cjs');
const { buildFixtureLevels, createFixtureOutput } = require('../electron/fixture-output.cjs');
const { startLanServer } = require('../electron/lan-server.cjs');

function zip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const filename = Buffer.from(name), data = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, filename); offset += local.length + filename.length + data.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const gdtf = zip({ 'wheels/gobo.png': Buffer.from([0]), 'description.xml': `<GDTF><FixtureType Name="Orbit RGB" Manufacturer="Acme"><DMXModes><DMXMode Name="16 bit"><DMXChannels>
  <DMXChannel Offset="1"><LogicalChannel Attribute="Dimmer"><ChannelFunction Attribute="Dimmer"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="2"><LogicalChannel Attribute="Shutter"><ChannelFunction Attribute="Shutter"><ChannelSet Name="Closed" DMXFrom="0/1"/><ChannelSet Name="Open" DMXFrom="32/1"/></ChannelFunction></LogicalChannel></DMXChannel>
  <DMXChannel Offset="3"><LogicalChannel Attribute="ColorAdd_R"><ChannelFunction Attribute="ColorAdd_R"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="4"><LogicalChannel Attribute="ColorAdd_G"><ChannelFunction Attribute="ColorAdd_G"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="5"><LogicalChannel Attribute="ColorAdd_B"><ChannelFunction Attribute="ColorAdd_B"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="6,7"><LogicalChannel Attribute="Pan"><ChannelFunction Attribute="Pan"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="8,9"><LogicalChannel Attribute="Tilt"><ChannelFunction Attribute="Tilt"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="10"><LogicalChannel Attribute="Gobo1"><ChannelFunction Attribute="Gobo1"><ChannelSet Name="Open" DMXFrom="0/1"/><ChannelSet Name="Dots" DMXFrom="20/1"/><ChannelSet Name="Breakup" DMXFrom="40/1"/></ChannelFunction></LogicalChannel></DMXChannel>
  <DMXChannel Offset="11"><LogicalChannel Attribute="Gobo1Pos"><ChannelFunction Name="Rotate CW" Attribute="Gobo1Pos" DMXFrom="128/1"/></LogicalChannel></DMXChannel>
  </DMXChannels></DMXMode></DMXModes></FixtureType></GDTF>` });

const mvr = zip({
  'GeneralSceneDescription.xml': `<GeneralSceneDescription><Scene><Layers><Layer><ChildList>
    <Fixture name="Stage Left" uuid="a"><GDTFSpec>Acme@Orbit</GDTFSpec><GDTFMode>16 bit</GDTFMode><Addresses><Address break="0">1.1</Address></Addresses><FixtureID>101</FixtureID></Fixture>
    <Fixture name="Stage Right" uuid="b"><GDTFSpec>Acme@Orbit</GDTFSpec><GDTFMode>16 bit</GDTFMode><Addresses><Address break="0">513</Address></Addresses><FixtureID>102</FixtureID></Fixture>
  </ChildList></Layer></Layers></Scene></GeneralSceneDescription>`,
  'Acme@Orbit.gdtf': gdtf,
});

test('MVR importer reads patch, groups fixture types and maps embedded GDTF functions', () => {
  assert.deepEqual(parseAddress('3.27'), { universe: 3, address: 27 });
  assert.deepEqual(parseAddress('513'), { universe: 2, address: 1 });
  const rig = parseMvr(mvr, 'Show.mvr');
  assert.equal(rig.fixtures.length, 2); assert.equal(rig.fixtures[1].universe, 2); assert.equal(rig.fixtures[1].address, 1);
  assert.equal(rig.fixtures[0].manufacturer, 'Acme'); assert.equal(rig.fixtures[0].model, 'Orbit RGB'); assert.equal(rig.fixtures[0].profileStatus, 'mapped');
  assert.equal(rig.fixtures[0].channels.pan.fine, 7); assert.deepEqual(rig.fixtures[0].channels.gobo1.slots.map(slot => slot.value), [20, 40]);
  assert.equal(new Set(rig.fixtures.map(fixture => fixture.groupId)).size, 1); assert.deepEqual(rig.warnings, []);
  const group = groupFixtures(rig.fixtures)[0]; assert.deepEqual(group.support, {output:2,color:2,pan:2,tilt:2,gobo1:2,gobo2:0});
});

test('fixture test levels span universes and follow color, motion and gobo mappings', () => {
  const rig = parseMvr(mvr, 'Show.mvr'), group = rig.fixtures[0].groupId;
  const config = { groups:[group], tests:{ output:true,color:true,pan:true,tilt:false,gobo1:true,gobo2:false } };
  const built = buildFixtureLevels(rig.fixtures, config, 1500);
  assert.equal(built.fixtureCount, 2); assert.deepEqual([...built.universes.keys()], [1, 2]);
  for (const levels of built.universes.values()) { assert.equal(levels[0], 255); assert.equal(levels[1], 32); assert.equal(levels[9], 40); assert.equal(levels[10], 128); }
  assert.notEqual(built.universes.get(1)[2], built.universes.get(1)[3]);
});

test('fixture output emits multi-universe packets and exposes Art-Net priority limitation', () => {
  const rig = parseMvr(mvr, 'Show.mvr'), sent = [];
  const socket = { bind(_options, callback) { callback(); }, setBroadcast() {}, setMulticastInterface() {}, send(packet, port, address) { sent.push({packet,port,address}); }, close() {} };
  const output = createFixtureOutput({ createSocket: () => socket, getFixtures: () => rig.fixtures, now: () => 1000 });
  const group = rig.fixtures[0].groupId;
  let state = output.update({ protocol:'sACN', priority:120, groups:[group], tests:{output:true} });
  assert.equal(state.enabled, true); assert.equal(state.fixtureCount, 2); assert.deepEqual(state.universes, [1,2]); assert.equal(sent.length, 2); assert.equal(sent[0].packet[108], 120);
  sent.length = 0; state = output.update({ protocol:'Art-Net', priority:90, groups:[group], tests:{output:true} });
  assert.match(state.priorityTransport, /no priority field/); assert.equal(sent.at(-1).port, 6454); assert.equal(sent.at(-1).packet.readUInt16LE(14), 1);
  sent.length = 0; state = output.stop(); assert.equal(state.enabled, false); assert.equal(sent.length, 6); assert.ok(sent.every(item => item.packet.subarray(18).every(value => value === 0)));
  output.close();
});

test('sACN fixture stop sends three stream-terminated blackout frames per universe', () => {
  const rig = parseMvr(mvr, 'Show.mvr'), sent = [];
  const socket = { bind(_options, callback) { callback(); }, setBroadcast() {}, setMulticastInterface() {}, send(packet) { sent.push(packet); }, close() {} };
  const output = createFixtureOutput({ createSocket: () => socket, getFixtures: () => rig.fixtures, now: () => 1000 });
  output.update({ protocol:'sACN', priority:120, groups:[rig.fixtures[0].groupId], tests:{output:true} });
  sent.length = 0; output.stop();
  assert.equal(sent.length, 6); assert.ok(sent.every(packet => packet[112] === 0x40)); assert.ok(sent.every(packet => packet.subarray(126).every(value => value === 0)));
  output.close();
});

test('LAN fixture APIs remain disabled while the fixture workspace is deferred', async () => {
  const lan = await startLanServer({ root:path.join(__dirname, '..', 'desktop-web'), host:'127.0.0.1', preferredPort:49120, listenerOptions:{ports:{sacn:0,artnet:0},bindAddress:'127.0.0.1',joinMulticast:false} });
  try {
    const imported = await fetch(lan.url + '/api/fixtures/import', { method:'POST', headers:{'Content-Type':'application/octet-stream','X-Lux-Link-Filename':encodeURIComponent('Show.mvr')}, body:mvr });
    assert.equal(imported.status, 405);
    assert.equal((await fetch(lan.url + '/api/fixtures/test', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status, 405);
    assert.equal((await fetch(lan.url + '/api/fixtures')).status, 404);
  } finally { lan.server.closeAllConnections(); await new Promise(resolve => lan.server.close(resolve)); }
});

module.exports = { mvr };
