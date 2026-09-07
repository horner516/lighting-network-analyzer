const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 160 * 1024 * 1024;

function decodeXml(value = '') {
  return value.replace(/&(?:#(x)?([0-9a-f]+)|amp|lt|gt|quot|apos);/gi, token => {
    const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    if (named[token.toLowerCase()]) return named[token.toLowerCase()];
    const match = token.match(/^&#(x)?([0-9a-f]+);$/i);
    return match ? String.fromCodePoint(Number.parseInt(match[2], match[1] ? 16 : 10)) : token;
  });
}

function attribute(source = '', name) {
  const match = source.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return decodeXml(match?.[1] ?? match?.[2] ?? '');
}

function childText(source, name) {
  const match = source.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`, 'i'));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function xmlText(buffer) {
  let text = buffer.toString('utf8');
  while (text.length && text.charCodeAt(text.length - 1) === 0) text = text.slice(0, -1);
  return text;
}

function blocks(source, name) {
  const expression = new RegExp(`<(?:[\\w.-]+:)?${name}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`, 'gi');
  return [...source.matchAll(expression)].map(match => ({ attributes: match[1], body: match[2] }));
}

function startTags(source, name) {
  const expression = new RegExp(`<(?:[\\w.-]+:)?${name}\\b([^>]*)\\/?\\s*>`, 'gi');
  return [...source.matchAll(expression)].map(match => match[1]);
}

function extractZip(input, { rootOnly = false } = {}) {
  const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!data.length || data.length > MAX_ARCHIVE_BYTES) throw new RangeError('Choose an MVR file smaller than 100 MB.');
  let end = -1;
  for (let offset = data.length - 22; offset >= Math.max(0, data.length - 65557); offset--) {
    if (data.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new RangeError('This is not a valid MVR/ZIP archive.');
  const entries = data.readUInt16LE(end + 10);
  const centralOffset = data.readUInt32LE(end + 16);
  if (entries === 0xffff || centralOffset === 0xffffffff) throw new RangeError('ZIP64 MVR files are not supported.');
  const result = new Map();
  let offset = centralOffset, expanded = 0;
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > data.length || data.readUInt32LE(offset) !== 0x02014b50) throw new RangeError('The MVR ZIP directory is damaged.');
    const flags = data.readUInt16LE(offset + 8), method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20), size = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28), extraLength = data.readUInt16LE(offset + 30), commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString(flags & 0x800 ? 'utf8' : 'latin1');
    if (flags & 1) throw new RangeError('Encrypted MVR files are not supported.');
    if (method !== 0 && method !== 8) throw new RangeError(`Unsupported compression in ${name}.`);
    const parts = name.split('/');
    if (!name || name.includes('\\') || parts.some(part => part === '..') || name.startsWith('/') || (rootOnly && name.includes('/'))) throw new RangeError(rootOnly ? 'MVR resources must be stored at the archive root.' : 'The archive contains an unsafe resource path.');
    if (localOffset + 30 > data.length || data.readUInt32LE(localOffset) !== 0x04034b50) throw new RangeError('The MVR ZIP entry is damaged.');
    const localNameLength = data.readUInt16LE(localOffset + 26), localExtraLength = data.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    if (start + compressedSize > data.length) throw new RangeError('The MVR ZIP entry is truncated.');
    const packed = data.subarray(start, start + compressedSize);
    const content = method === 0 ? Buffer.from(packed) : zlib.inflateRawSync(packed, { maxOutputLength: Math.min(size + 1, MAX_EXPANDED_BYTES) });
    if (content.length !== size) throw new RangeError(`The MVR resource ${name} has an invalid size.`);
    expanded += size;
    if (expanded > MAX_EXPANDED_BYTES) throw new RangeError('The expanded MVR file is too large.');
    result.set(name.toLowerCase(), { name, content });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}

function parseDmxValue(value) {
  const match = String(value || '').match(/^(\d+)(?:\/(\d+))?$/);
  if (!match) return null;
  const raw = Number(match[1]), bytes = Number(match[2] || 1);
  if (!Number.isSafeInteger(raw) || bytes < 1 || bytes > 4) return null;
  return Math.max(0, Math.min(255, bytes === 1 ? raw : Math.floor(raw / (256 ** (bytes - 1)))));
}

function parseAddress(value) {
  const text = String(value || '').trim();
  const dotted = text.match(/^(\d+)\.(\d+)$/);
  if (dotted) {
    const universe = Number(dotted[1]), address = Number(dotted[2]);
    if (universe >= 1 && address >= 1 && address <= 512) return { universe, address };
  }
  if (!/^\d+$/.test(text)) return null;
  const absolute = Number(text);
  if (!Number.isSafeInteger(absolute) || absolute < 1) return null;
  return { universe: Math.floor((absolute - 1) / 512) + 1, address: ((absolute - 1) % 512) + 1 };
}

function channelDescriptor(channel) {
  const offsets = attribute(channel.attributes, 'Offset').split(',').map(Number).filter(value => Number.isInteger(value) && value > 0);
  if (!offsets.length) return null;
  const attributes = [...channel.body.matchAll(/\bAttribute\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)].map(match => match[1] || match[2]);
  const label = attributes.join(' ');
  const sets = startTags(channel.body, 'ChannelSet').map(attributes => ({ name: attribute(attributes, 'Name'), value: parseDmxValue(attribute(attributes, 'DMXFrom')) })).filter(set => set.value !== null);
  const open = sets.find(set => /open|opened/i.test(set.name))?.value;
  const rotating = startTags(channel.body, 'ChannelFunction').map(attributes => ({ name: `${attribute(attributes, 'Name')} ${attribute(attributes, 'Attribute')}`, value: parseDmxValue(attribute(attributes, 'DMXFrom')) })).find(item => /rotate|spin/i.test(item.name) && item.value !== null);
  return { coarse: offsets[0], fine: offsets[1] || null, label, sets, open: open ?? null, testValue: rotating?.value ?? null };
}

function parseGdtf(buffer, requestedMode) {
  const archive = extractZip(buffer);
  const description = archive.get('description.xml');
  if (!description) throw new RangeError('Embedded GDTF is missing description.xml.');
  const xml = xmlText(description.content);
  const fixtureTypeTag = xml.match(/<(?:[\w.-]+:)?FixtureType\b([^>]*)>/i)?.[1] || '';
  const manufacturer = attribute(fixtureTypeTag, 'Manufacturer');
  const model = attribute(fixtureTypeTag, 'Name');
  const modes = blocks(xml, 'DMXMode');
  const mode = modes.find(item => attribute(item.attributes, 'Name') === requestedMode);
  if (!mode) throw new RangeError(`GDTF mode “${requestedMode || 'Not specified'}” was not found.`);
  const descriptors = blocks(mode.body, 'DMXChannel').map(channelDescriptor).filter(Boolean);
  const find = expression => descriptors.find(item => expression.test(item.label));
  const dimmer = find(/(?:^|\s)Dimmer(?:\s|$)/i);
  const shutter = find(/Shutter/i);
  const red = find(/ColorAdd_R|ColorRGB_R/i), green = find(/ColorAdd_G|ColorRGB_G/i), blue = find(/ColorAdd_B|ColorRGB_B/i);
  const pan = find(/(?:^|\s)Pan(?:\s|$)/i), tilt = find(/(?:^|\s)Tilt(?:\s|$)/i);
  const gobo1Rotate = find(/Gobo1Pos|Gobo1Rotate/i), gobo2Rotate = find(/Gobo2Pos|Gobo2Rotate/i);
  const gobo1 = descriptors.find(item => /(?:^|\s)Gobo1(?:\s|$)/i.test(item.label));
  const gobo2 = descriptors.find(item => /(?:^|\s)Gobo2(?:\s|$)/i.test(item.label));
  const normalize = item => item ? { coarse: item.coarse, fine: item.fine } : null;
  const gobo = (select, rotate) => select ? {
    select: normalize(select), rotate: rotate && rotate.testValue !== null ? { ...normalize(rotate), value: rotate.testValue } : null,
    slots: select.sets.filter(set => !/open|clear|white/i.test(set.name)).map(set => ({ name: set.name || 'Gobo', value: set.value })).filter((slot, index, list) => list.findIndex(other => other.value === slot.value) === index),
  } : null;
  return {
    manufacturer, model, mode: requestedMode,
    channels: {
      dimmer: normalize(dimmer), shutter: shutter && shutter.open !== null ? { ...normalize(shutter), value: shutter.open } : null,
      red: normalize(red), green: normalize(green), blue: normalize(blue), pan: normalize(pan), tilt: normalize(tilt),
      gobo1: gobo(gobo1, gobo1Rotate), gobo2: gobo(gobo2, gobo2Rotate),
    },
  };
}

function parseMvr(input, filename = 'Imported rig.mvr') {
  const archive = extractZip(input, { rootOnly: true });
  const scene = archive.get('generalscenedescription.xml');
  if (!scene) throw new RangeError('The MVR file is missing GeneralSceneDescription.xml.');
  const xml = xmlText(scene.content);
  const profileCache = new Map();
  const warnings = [];
  const fixtures = blocks(xml, 'Fixture').map((fixture, index) => {
    const name = attribute(fixture.attributes, 'name') || childText(fixture.body, 'FixtureID') || `Fixture ${index + 1}`;
    const uuid = attribute(fixture.attributes, 'uuid') || `fixture-${index + 1}`;
    const fixtureId = childText(fixture.body, 'FixtureID') || childText(fixture.body, 'FixtureIDNumeric') || '';
    const gdtfSpec = childText(fixture.body, 'GDTFSpec');
    const gdtfMode = childText(fixture.body, 'GDTFMode');
    const addressBlock = blocks(fixture.body, 'Address').find(item => !attribute(item.attributes, 'break') || attribute(item.attributes, 'break') === '0');
    const patch = parseAddress(addressBlock?.body.replace(/<[^>]+>/g, '').trim());
    let profile = null, profileError = '';
    if (!patch) profileError = 'No valid primary DMX address.';
    else if (!gdtfSpec || !gdtfMode) profileError = 'MVR does not include a GDTF profile and mode.';
    else {
      const key = `${gdtfSpec.toLowerCase()}\0${gdtfMode}`;
      try {
        if (!profileCache.has(key)) {
          const requested = [gdtfSpec, `${gdtfSpec}.gdtf`].map(value => value.toLowerCase());
          const resource = requested.map(value => archive.get(value)).find(Boolean);
          if (!resource) throw new RangeError(`Embedded GDTF “${gdtfSpec}” was not found.`);
          profileCache.set(key, parseGdtf(resource.content, gdtfMode));
        }
        profile = profileCache.get(key);
      } catch (error) { profileError = error.message; }
    }
    if (profileError) warnings.push(`${name}: ${profileError}`);
    const manufacturer = profile?.manufacturer || 'Unknown manufacturer';
    const model = profile?.model || gdtfSpec.replace(/\.gdtf$/i, '') || 'Unknown fixture';
    const groupId = Buffer.from(`${manufacturer}\0${model}\0${gdtfMode || 'Unknown mode'}`).toString('base64url');
    return {
      id: uuid, fixtureId, name, manufacturer, model, mode: gdtfMode || 'Unknown mode', gdtfSpec,
      universe: patch?.universe || null, address: patch?.address || null, groupId,
      channels: profile?.channels || null, profileStatus: profile ? 'mapped' : 'unsupported', profileError,
    };
  });
  if (!fixtures.length) throw new RangeError('No fixtures were found in this MVR file.');
  return { filename: path.basename(filename || 'Imported rig.mvr'), importedAt: new Date().toISOString(), fixtures, warnings: warnings.slice(0, 100) };
}

function groupFixtures(fixtures) {
  const grouped = new Map();
  for (const fixture of fixtures) {
    if (!grouped.has(fixture.groupId)) grouped.set(fixture.groupId, { id: fixture.groupId, manufacturer: fixture.manufacturer, model: fixture.model, mode: fixture.mode, fixtures: [] });
    grouped.get(fixture.groupId).fixtures.push(fixture);
  }
  return [...grouped.values()].map(group => {
    const mapped = group.fixtures.filter(fixture => fixture.profileStatus === 'mapped');
    const supports = key => mapped.filter(fixture => {
      const channels = fixture.channels || {};
      if (key === 'output') return channels.dimmer;
      if (key === 'color') return channels.red && channels.green && channels.blue;
      if (key === 'pan') return channels.pan && channels.tilt;
      if (key === 'gobo1' || key === 'gobo2') return channels[key]?.slots?.length;
      return channels[key];
    }).length;
    return { id: group.id, manufacturer: group.manufacturer, model: group.model, mode: group.mode, count: group.fixtures.length, mapped: mapped.length, universes: [...new Set(group.fixtures.map(item => item.universe).filter(Boolean))].sort((a, b) => a - b), support: { output: supports('dimmer'), color: supports('color'), pan: supports('pan'), tilt: supports('tilt'), gobo1: supports('gobo1'), gobo2: supports('gobo2') } };
  });
}

function createFixtureLibrary({ file = null } = {}) {
  let rig = null;
  try { if (file && fs.existsSync(file)) rig = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { rig = null; }
  function save() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${String(file)}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(rig), { mode: 0o600 });
    fs.renameSync(temporary, file);
  }
  return {
    import(input, filename) { rig = parseMvr(input, filename); save(); return this.snapshot(); },
    snapshot() { return { available: true, rig: rig ? { ...rig, groups: groupFixtures(rig.fixtures) } : null }; },
    fixtures() { return rig?.fixtures || []; },
  };
}

module.exports = { extractZip, parseAddress, parseGdtf, parseMvr, groupFixtures, createFixtureLibrary };
