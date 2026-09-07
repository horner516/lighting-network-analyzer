const dgram = require('node:dgram');
const crypto = require('node:crypto');
const { artNetFrame, sacnFrame } = require('./signal-transmitter.cjs');

const TESTS = ['output', 'color', 'pan', 'tilt', 'gobo1', 'gobo2'];

function validated(input = {}, current = {}) {
  const protocol = input.protocol ?? current.protocol ?? 'sACN';
  if (!['sACN', 'Art-Net'].includes(protocol)) throw new RangeError('Choose sACN or Art-Net.');
  const priority = Number(input.priority ?? current.priority ?? 100);
  if (!Number.isInteger(priority) || priority < 0 || priority > 200) throw new RangeError('Choose an output priority from 0 to 200.');
  const groups = input.groups ?? current.groups ?? [];
  if (!Array.isArray(groups) || groups.length > 500 || groups.some(value => typeof value !== 'string' || value.length > 512)) throw new RangeError('Choose valid fixture groups.');
  const suppliedTests = input.tests ?? current.tests ?? {};
  const tests = Object.fromEntries(TESTS.map(name => [name, suppliedTests[name] === true]));
  return { protocol, priority, groups: [...new Set(groups)], tests };
}

function setChannel(universes, fixture, descriptor, normalized) {
  if (!descriptor || !fixture.universe || !fixture.address) return;
  const coarseAddress = fixture.address + descriptor.coarse - 1;
  if (coarseAddress < 1 || coarseAddress > 512) return;
  if (!universes.has(fixture.universe)) universes.set(fixture.universe, Buffer.alloc(512));
  const levels = universes.get(fixture.universe);
  const word = Math.max(0, Math.min(65535, Math.round(normalized * 65535)));
  levels[coarseAddress - 1] = word >> 8;
  if (descriptor.fine) {
    const fineAddress = fixture.address + descriptor.fine - 1;
    if (fineAddress >= 1 && fineAddress <= 512) levels[fineAddress - 1] = word & 255;
  }
}

function setByte(universes, fixture, descriptor, value) {
  if (!descriptor || !fixture.universe || !fixture.address) return;
  const address = fixture.address + descriptor.coarse - 1;
  if (address < 1 || address > 512) return;
  if (!universes.has(fixture.universe)) universes.set(fixture.universe, Buffer.alloc(512));
  universes.get(fixture.universe)[address - 1] = Math.max(0, Math.min(255, Math.round(value)));
}

function buildFixtureLevels(fixtures, config, elapsedMs) {
  const universes = new Map();
  const selected = new Set(config.groups);
  const active = fixtures.filter(fixture => {
    if (!selected.has(fixture.groupId) || fixture.profileStatus !== 'mapped' || !fixture.channels || !fixture.universe || !fixture.address) return false;
    const channels = fixture.channels, tests = config.tests;
    return (tests.output && channels.dimmer) || (tests.color && channels.red && channels.green && channels.blue) || (tests.pan && channels.pan && channels.tilt) || (tests.tilt && channels.tilt) || (tests.gobo1 && channels.gobo1?.slots?.length) || (tests.gobo2 && channels.gobo2?.slots?.length);
  });
  const phase = elapsedMs / 1000;
  for (const fixture of active) {
    const channels = fixture.channels;
    const makeVisible = config.tests.output || config.tests.color || config.tests.gobo1 || config.tests.gobo2;
    if (makeVisible) {
      setChannel(universes, fixture, channels.dimmer, 1);
      if (channels.shutter) setByte(universes, fixture, channels.shutter, channels.shutter.value ?? 255);
    }
    if (config.tests.color && channels.red && channels.green && channels.blue) {
      const hue = (phase / 6) % 1;
      const x = hue * 6, section = Math.floor(x), fraction = x - section;
      const rgb = [[1,fraction,0],[1-fraction,1,0],[0,1,fraction],[0,1-fraction,1],[fraction,0,1],[1,0,1-fraction]][section % 6];
      setChannel(universes, fixture, channels.red, rgb[0]); setChannel(universes, fixture, channels.green, rgb[1]); setChannel(universes, fixture, channels.blue, rgb[2]);
    }
    if (config.tests.pan && channels.pan && channels.tilt) {
      const segment = Math.floor(phase / 3), direction = segment % 2 === 0 ? 1 : -1;
      const angle = direction * ((phase % 3) / 3) * Math.PI * 2;
      setChannel(universes, fixture, channels.pan, 0.5 + Math.cos(angle) * 0.25);
      setChannel(universes, fixture, channels.tilt, 0.5 + Math.sin(angle) * 0.25);
    } else if (config.tests.tilt && channels.tilt) {
      const position = (phase % 3) / 3;
      setChannel(universes, fixture, channels.tilt, position < 0.5 ? position * 2 : (1 - position) * 2);
    }
    for (const wheel of ['gobo1', 'gobo2']) if (config.tests[wheel] && channels[wheel]?.slots?.length) {
      const gobo = channels[wheel], slot = gobo.slots[Math.floor(phase) % gobo.slots.length];
      setByte(universes, fixture, gobo.select, slot.value);
      if (gobo.rotate) setByte(universes, fixture, gobo.rotate, gobo.rotate.value);
    }
  }
  return { universes, fixtureCount: active.length };
}

function createFixtureOutput({ createSocket = type => dgram.createSocket(type), intervalMs = 33, cid = crypto.randomBytes(16), interfaceIp = '', getFixtures = () => [], now = () => Date.now() } = {}) {
  const socket = createSocket('udp4');
  socket.bind(interfaceIp ? { port: 0, address: interfaceIp } : 0, () => { socket.setBroadcast(true); if (interfaceIp) socket.setMulticastInterface?.(interfaceIp); });
  let config = validated(), timer = null, sequence = 0, startedAt = now(), lastFixtureCount = 0, lastUniverses = [];
  function configEnabled(value) { return value.groups.length > 0 && TESTS.some(name => value.tests[name]); }
  function enabled() { return configEnabled(config); }
  function send() {
    if (!enabled()) return;
    sequence = sequence >= 255 ? 1 : sequence + 1;
    const built = buildFixtureLevels(getFixtures(), config, now() - startedAt);
    lastFixtureCount = built.fixtureCount; lastUniverses = [...built.universes.keys()].sort((a, b) => a - b);
    for (const [universe, levels] of built.universes) {
      const wireUniverse = config.protocol === 'Art-Net' ? universe - 1 : universe;
      if (wireUniverse < (config.protocol === 'sACN' ? 1 : 0) || wireUniverse > (config.protocol === 'sACN' ? 63999 : 32767)) continue;
      const packet = config.protocol === 'sACN' ? sacnFrame(wireUniverse, levels, sequence, cid, config.priority) : artNetFrame(wireUniverse, levels, sequence);
      const address = config.protocol === 'sACN' ? `239.255.${wireUniverse >> 8}.${wireUniverse & 255}` : '255.255.255.255';
      socket.send(packet, config.protocol === 'sACN' ? 5568 : 6454, address, () => {});
    }
  }
  function endStreams() {
    const levels = Buffer.alloc(512);
    for (let repeat = 0; repeat < 3; repeat++) for (const universe of lastUniverses) {
      sequence = sequence >= 255 ? 1 : sequence + 1;
      const wireUniverse = config.protocol === 'Art-Net' ? universe - 1 : universe;
      const packet = config.protocol === 'sACN' ? sacnFrame(wireUniverse, levels, sequence, cid, config.priority, 0x40) : artNetFrame(wireUniverse, levels, sequence);
      const address = config.protocol === 'sACN' ? `239.255.${wireUniverse >> 8}.${wireUniverse & 255}` : '255.255.255.255';
      socket.send(packet, config.protocol === 'sACN' ? 5568 : 6454, address, () => {});
    }
  }
  function update(input = {}) {
    const wasEnabled = enabled();
    const next = validated(input, config);
    const changesStream = next.protocol !== config.protocol || next.groups.join('\0') !== config.groups.join('\0');
    if (wasEnabled && (!configEnabled(next) || changesStream)) endStreams();
    config = next; startedAt = now();
    clearInterval(timer); timer = enabled() ? setInterval(send, intervalMs) : null; timer?.unref?.();
    if (enabled()) send(); else { lastFixtureCount = 0; lastUniverses = []; }
    return snapshot();
  }
  function stop() { return update({ tests: {} }); }
  function snapshot() {
    return { available: true, enabled: enabled(), interfaceIp, protocol: config.protocol, priority: config.priority, priorityTransport: config.protocol === 'sACN' ? 'sACN packet priority' : 'not supported; ArtDmx has no priority field', groups: config.groups, tests: config.tests, fixtureCount: lastFixtureCount, universes: lastUniverses, frameRate: Math.round(1000 / intervalMs) };
  }
  function close() { if (enabled()) endStreams(); clearInterval(timer); socket.close(); }
  return { update, stop, snapshot, close };
}

module.exports = { TESTS, validated, buildFixtureLevels, createFixtureOutput };
