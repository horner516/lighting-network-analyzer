import { networkInterfaces } from 'node:os';

export function serverInfo(port, host, interfaces = networkInterfaces()) {
  const addresses = host === '0.0.0.0' || host === '::'
    ? [...new Set(Object.values(interfaces).flat().filter(item => item && !item.internal && item.family === 'IPv4').map(item => item.address))]
    : [host];
  return { port, urls: addresses.map(ip => `http://${ip.includes(':') ? `[${ip}]` : ip}:${port}`) };
}

export default function lanInfoPlugin() {
  return {
    name: 'lighting-lan-info',
    configureServer(server) {
      if (!process.env.NETWORK_ANALYZER_HOST) return;
      const info = () => {
        const address = server.httpServer?.address();
        return address && typeof address === 'object'
          ? serverInfo(address.port, process.env.NETWORK_ANALYZER_HOST)
          : null;
      };
      server.middlewares.use('/api/server-info', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(info()));
      });
      server.httpServer?.once('listening', () => {
        const details = info();
        console.log('Dashboard LAN addresses:', details?.urls.join(', ') || 'No LAN interface available');
        process.send?.({ type: 'server-ready', ...details });
      });
    },
  };
}
