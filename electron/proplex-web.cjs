const http = require('node:http');
const { validTarget } = require('./node-poller.cjs');

// Only the read-only status document; never submit forms or send remote-screen keys.
function readStatus(ip) {
  if (!validTarget(ip)) return Promise.reject(new RangeError('Unsupported device address.'));
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: ip, port: 80, path: '/status.htm', agent: false }, res => {
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
function text(value = '') {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;?/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function normalizeProplex(ip, html) {
  if (typeof html !== 'string' || html.length > 131072 || !/proplex_logo\.png/i.test(html)) throw new Error('Not a supported ProPlex status page.');
  const model = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const type = html.match(/var\s+node_type\s*=\s*["']([^"']+)["']/i)?.[1];
  const count = { '16U16IO': 16, '8U8IO': 8, '6U6IO': 6, '4U16IO': 4 }[type?.replace(/2E$/, '')];
  if (!/^IQ Two\b/i.test(model) || !count) throw new Error('Unsupported ProPlex model/status format.');
  const field = label => text(html.match(new RegExp('<font\\b[^>]*>\\s*' + label + '\\s*</font>\\s*<br\\s*/?>\\s*([^<]*)', 'i'))?.[1]);
  const protocolText = field('Protocol');
  const protocol = /^sACN$/i.test(protocolText) ? 'sACN' : /^Art[ -]?Net$/i.test(protocolText) ? 'Art-Net' : null;
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
    const valid = reported !== null && protocol && reported >= (protocol === 'sACN' ? 1 : 0) && reported <= (protocol === 'sACN' ? 63999 : 32767);
    const address = configured && valid ? reported : null;
    return { index, label, direction, inputAddress: direction === 'IN' ? address : null, outputAddress: direction === 'OUT' ? address : null,
      inputProtocol: direction === 'IN' ? protocol : null, outputProtocol: direction === 'OUT' ? protocol : null,
      displayUniverse: reported, addressNote: 'Universe shown exactly as reported by the ProPlex web monitor.',
      rdm: /^On$/i.test(cells[5]) ? true : /^Off$/i.test(cells[5]) ? false : null,
      active: null, frameRate, error: reported !== null && protocol && !valid ? `Reported ${protocol} universe ${reported} is outside its valid range.` : null };
  });
  const warnings = [];
  if (ports.some(p => p.direction === 'Unknown')) warnings.push('Some port settings were not reported.');
  if (!decimal) warnings.push('Universe display format is unsupported; select Decimal on the device to read universe numbers.');
  if (!protocol) warnings.push('Protocol was not recognized.');
  return { ip, checkedAt: Date.now(), responding: true, source: 'ProPlex web monitor', proplex: true,
    name: text(html.match(/<b>\s*Node Name\s*<\/b>([\s\S]*?)<\/td>/i)?.[1]) || model,
    description: model, subnetMask, firmware: field('Master'), firmwareCode: null, mac: field('MAC Address'), ports,
    report: 'Configuration retrieved', note: 'Read-only ProPlex web-monitor snapshot. Port configuration does not confirm signal presence or device health.', error: warnings.join(' ') };
}
async function pollProplex(ip) { return normalizeProplex(ip, await readStatus(ip)); }
module.exports = { readStatus, normalizeProplex, pollProplex };
