import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { startLanServer } from '../electron/lan-server.cjs';
const lan = await startLanServer({
  deviceStorePath: process.env.LNA_DEVICE_STORE || join(homedir(), '.lux-link', 'devices.json'),
  root: fileURLToPath(new URL('../desktop-web', import.meta.url)),
  preferredPort: Number(process.env.NETWORK_ANALYZER_PORT || 47652),
  host: process.env.NETWORK_ANALYZER_HOST || '0.0.0.0',
});
console.log(`Local: ${lan.url}`);
console.log('LAN:', lan.info().urls.join(', '));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { lan.server.close(); lan.server.closeAllConnections(); });
