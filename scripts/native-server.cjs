const { homedir } = require('node:os');
const { join, resolve } = require('node:path');
const { mkdirSync, writeFileSync } = require('node:fs');
const { startLanServer } = require('./electron/lan-server.cjs');

async function main() {
  const root = resolve(process.argv[2] || join(__dirname, '..', 'desktop-web'));
  const support = process.env.LNA_APP_SUPPORT || join(homedir(), 'Library', 'Application Support', 'lighting-network-analyzer');
  mkdirSync(support, { recursive: true, mode: 0o700 });
  const lan = await startLanServer({
    root,
    deviceStorePath: join(support, 'devices.json'),
    preferredPort: Number(process.env.NETWORK_ANALYZER_PORT || 47652),
    host: process.env.NETWORK_ANALYZER_HOST || '0.0.0.0',
  });
  const state = { ok: true, url: lan.url, port: lan.port, urls: lan.info().urls };
  if (process.env.LNA_SERVER_INFO) writeFileSync(process.env.LNA_SERVER_INFO, JSON.stringify(state), { mode: 0o600 });
  console.log(`LUX_LINK_READY ${JSON.stringify(state)}`);
  if (process.argv.includes('--smoke')) {
    const response = await fetch(lan.url);
    if (!response.ok) throw Error('Native server smoke check failed.');
    lan.server.closeAllConnections();
    await new Promise(resolveClose => lan.server.close(resolveClose));
    return;
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { lan.server.closeAllConnections(); lan.server.close(); });
}

main().catch(error => { console.error(error); process.exitCode = 1; });
