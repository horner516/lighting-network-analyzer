const http = require('node:http');
const { validTarget } = require('./node-poller.cjs');

function pollMaConsole(ip) {
  if (!validTarget(ip)) return Promise.reject(new RangeError('Unsupported console address.'));
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: ip, port: 8080, path: '/', method: 'GET', agent: false }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(Error(`MA Web Remote: HTTP ${response.statusCode}`)); return; }
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 32768) request.destroy(Error('MA response exceeded size limit.')); else chunks.push(chunk); });
      response.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');
        if (!/<title>\s*MA Webremote\s*<\/title>/i.test(html)) { reject(Error('Not a recognized MA Web Remote.')); return; }
        resolve({ ip, checkedAt: Date.now(), responding: true, source: 'MA Web Remote', name: `grandMA station ${ip}`, description: 'grandMA console', proplex: false, ports: [], subnetMask: null, firmwareCode: null, mac: '', report: 'Web Remote responding on TCP 8080', note: 'Session name is not exposed by the public web-remote landing page. Active output universes are derived from received sACN and Art-Net.', error: '' });
      });
    });
    const timer = setTimeout(() => request.destroy(Error('MA Web Remote timed out.')), 2000);
    request.on('close', () => clearTimeout(timer)); request.on('error', reject);
  });
}
module.exports = { pollMaConsole };
