const http = require('node:http');
const { validTarget } = require('./node-poller.cjs');

// GET only; never submit forms or send remote-screen keys.
function readPage(ip, page) {
  if (!validTarget(ip) || !['/status.htm', '/protocol_setup.htm'].includes(page)) return Promise.reject(new RangeError('Unsupported device request.'));
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: ip, port: 80, path: page, method: 'GET', agent: false }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('ProPlex status unavailable.')); return; }
      const chunks = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 131072) req.destroy(new Error('ProPlex status exceeded size limit.'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve(Buffer.concat(chunks).toString('latin1')));
    });
    const timer = setTimeout(() => req.destroy(new Error('ProPlex web monitor timed out.')), 2000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
  });
}
function readStatus(ip) { return readPage(ip, '/status.htm'); }
function protocolSettings(html) {
  if (typeof html !== 'string' || html.length > 131072 || !/proplex_logo\.png/i.test(html)) return null;
  const checked = name => {
    const controls = [...html.matchAll(/<input\b[^>]*>/gi)].map(m => m[0]).filter(tag => new RegExp('\\bname\\s*=\\s*["\']' + name + '["\']', 'i').test(tag));
    if (controls.length !== 1 || !/\btype\s*=\s*["']checkbox["']/i.test(controls[0])) return null;
    return /\schecked(?:\s|=|\/?>)/i.test(controls[0]);
  };
  const artnet = checked('ArtNetEnabled'), sacn = checked('sACNEnabled'), rttrpl = checked('RTTrPLEnabled');
  if (artnet === null || sacn === null) return null;
  return { artnet, sacn, rttrpl, protocol: artnet && sacn ? 'Art-Net / sACN' : sacn ? 'sACN' : artnet ? 'Art-Net' : 'None enabled' };
}
function text(value = '') {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;?/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function normalizeProplex(ip, html, setupHtml) {
  if (typeof html !== 'string' || html.length > 131072 || !/proplex_logo\.png/i.test(html)) throw new Error('Not a supported ProPlex status page.');
  const model = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const type = html.match(/var\s+node_type\s*=\s*["']([^"']+)["']/i)?.[1];
  const count = { '16U16IO': 16, '8U8IO': 8, '6U6IO': 6, '4U16IO': 4 }[type?.replace(/2E$/, '')];
  if (!/^IQ Two\b/i.test(model) || !count) throw new Error('Unsupported ProPlex model/status format.');
  // Firmware variants wrap the value in a font/span or insert an extra break.
  // Read the remainder of the labelled cell, not only the first bare text node.
  const field = label => text(html.match(new RegExp('<(font|span|strong|b|label)\\b[^>]*>\\s*' + label + '\\s*</\\1>\\s*<br\\s*/?>\\s*([\\s\\S]*?)</td>', 'i'))?.[2]);
  const protocolText = field('Protocol');
  const sacn = /\bsACN\b|\bE1\.31\b/i.test(protocolText), artnet = /\bArt[ -]?Net\b/i.test(protocolText);
  const settings = protocolSettings(setupHtml);
  const protocol = settings ? settings.protocol : sacn && artnet ? 'Art-Net / sACN' : sacn ? 'sACN' : artnet ? 'Art-Net' : null;
  const subnet = field('Subnet Mask');
  const subnetMask = /^\d{1,3}(\.\d{1,3}){3}$/.test(subnet) && subnet.split('.').every(n => Number(n) <= 255) ? subnet : null;
  const rate = field('DMX Rate').match(/^(\d+)\s*Hz$/i);
  const frameRate = rate ? Number(rate[1]) : null;
  const section = html.split(/<b>\s*Port Routing\s*<\/b>/i)[1]?.split(/<b>\s*Protocol\s*<\/b>/i)[0] || '';
  const decimal = /Decimal\s*\(0\.\.32767\)/i.test(section);
  const rows = new Map();
  for (const row of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => text(m[1]));
    if (/^[A-P]$/.test(cells[0] || '')) {
      if (rows.has(cells[0])) throw new Error('Ambiguous ProPlex port rows.');
      rows.set(cells[0], cells);
    }
  }
  if (!rows.size) throw new Error('ProPlex port status was not available.');
  const ports = Array.from({ length: count }, (_, index) => {
    const label = String.fromCharCode(65 + index), cells = rows.get(label) || [];
    const direction = /^Output$/i.test(cells[1]) ? 'OUT' : /^Input$/i.test(cells[1]) ? 'IN' : /^Disabled$/i.test(cells[1]) ? 'Disabled' : 'Unknown';
    const configured = direction === 'IN' || direction === 'OUT';
    const reported = decimal && /^\d+$/.test(cells[3] || '') ? Number(cells[3]) : null;
    const valid = reported !== null && protocol && protocol !== 'None enabled' && reported >= (protocol === 'sACN' ? 1 : 0) && reported <= (protocol === 'sACN' ? 63999 : 32767);
    const address = configured && valid ? reported : null;
    return { index, label, direction, inputAddress: direction === 'IN' ? address : null, outputAddress: direction === 'OUT' ? address : null,
      inputProtocol: direction === 'IN' ? protocol : null, outputProtocol: direction === 'OUT' ? protocol : null,
      displayUniverse: reported, addressNote: 'Universe shown exactly as reported by the ProPlex web monitor.',
      rdm: /^On$/i.test(cells[5]) ? true : /^Off$/i.test(cells[5]) ? false : null,
      active: null, frameRate, error: reported !== null && protocol && protocol !== 'None enabled' && !valid ? `Reported ${protocol} universe ${reported} is outside its valid range.` : null };
  });
  const warnings = [];
  if (ports.some(p => p.direction === 'Unknown')) warnings.push('Some port settings were not reported.');
  if (!decimal) warnings.push('Universe display format is unsupported; select Decimal on the device to read universe numbers.');
  return { ip, checkedAt: Date.now(), responding: true, source: 'ProPlex web monitor', proplex: true,
    protocolSource: settings ? 'protocol_setup.htm' : 'status.htm', protocolSettings: settings,
    name: text(html.match(/<b>\s*Node Name\s*<\/b>([\s\S]*?)<\/td>/i)?.[1]) || model,
    description: model, subnetMask, firmware: field('Master'), firmwareCode: null, mac: field('MAC Address'), ports,
    report: '', note: '', error: warnings.join(' ') };
}
async function pollProplex(ip, { read = readPage } = {}) {
  const status = await read(ip, '/status.htm');
  const snapshot = normalizeProplex(ip, status);
  try { return normalizeProplex(ip, status, await read(ip, '/protocol_setup.htm')); }
  catch { return snapshot; }
}
module.exports = { readStatus, readPage, protocolSettings, normalizeProplex, pollProplex };
