const http = require('node:http');
const { execFile } = require('node:child_process');
const { validTarget } = require('./node-poller.cjs');

function readLanding(ip) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: ip, port: 8080, path: '/', method: 'GET', agent: false }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(Error(`MA Web Remote: HTTP ${response.statusCode}`)); return; }
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 32768) request.destroy(Error('MA response exceeded size limit.')); else chunks.push(chunk); });
      response.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');
        if (!/<title>\s*MA Webremote\s*<\/title>/i.test(html)) reject(Error('Not a recognized MA Web Remote.'));
        else resolve();
      });
    });
    const timer = setTimeout(() => request.destroy(Error('MA Web Remote timed out.')), 2000);
    request.on('close', () => clearTimeout(timer)); request.on('error', reject);
  });
}

function readWebRemoteMetadata(ip, { helper = process.env.LNA_MA_READER, run = execFile } = {}) {
  if (!helper) return Promise.resolve({ error: 'Session reader is available in the packaged Mac app.' });
  return new Promise(resolve => {
    run(helper, [ip], { timeout: 12000, maxBuffer: 32768, windowsHide: true }, (error, stdout) => {
      if (error) { resolve({ error: 'Web Remote screen metadata was not readable.' }); return; }
      try {
        const result = JSON.parse(stdout);
        resolve({
          sessionName: typeof result.sessionName === 'string' ? result.sessionName.slice(0, 128) : null,
          showFile: typeof result.showFile === 'string' ? result.showFile.slice(0, 128) : null,
          sessionStatus: typeof result.sessionStatus === 'string' ? result.sessionStatus.slice(0, 64) : null,
          error: typeof result.error === 'string' ? result.error.slice(0, 160) : '',
        });
      } catch { resolve({ error: 'Web Remote screen metadata returned an invalid response.' }); }
    });
  });
}

async function pollMaConsole(ip, { read = readLanding, metadata = readWebRemoteMetadata } = {}) {
  if (!validTarget(ip)) throw new RangeError('Unsupported console address.');
  await read(ip);
  const details = await metadata(ip).catch(() => ({ error: 'Web Remote screen metadata was not readable.' }));
  return { ip, checkedAt: Date.now(), responding: true, online: true, reachabilitySource: 'web', source: 'MA Web Remote', name: `grandMA station ${ip}`, description: 'grandMA console', proplex: false, ports: [], subnetMask: null, firmwareCode: null, mac: '',
    consoleBrand: 'MA Lighting', consoleFamily: 'grandMA', consoleServicePort: 8080,
    sessionName: details.sessionName || null, showFile: details.showFile || null, sessionStatus: details.sessionStatus || null,
    metadataStatus: details.error || (details.sessionName || details.showFile ? 'Read from the MA Web Remote Network view.' : 'Session and show file were not reported.'),
    report: 'Web Remote responding on TCP 8080', note: 'Active output universes are derived from received sACN and Art-Net.', error: '' };
}

module.exports = { pollMaConsole, readLanding, readWebRemoteMetadata };
