const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { networkInterfaces } = require('node:os');
const { createSignalListener } = require('./signal-listener.cjs');
const { createDevicePoller } = require('./netron-api.cjs');
const { createDeviceInventory } = require('./device-inventory.cjs');
const { validTarget } = require('./node-poller.cjs');
const { createReleaseChecker } = require('../lib/release-check.cjs');
const { version } = require('../package.json');

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function addresses(port, host) {
  const ips = ['0.0.0.0', '::'].includes(host)
    ? [...new Set(Object.values(networkInterfaces()).flat().filter(item => item && !item.internal && item.family === 'IPv4').map(item => item.address))]
    : [host];
  return { port, urls: ips.map(ip => `http://${ip.includes(':') ? `[${ip}]` : ip}:${port}`) };
}

async function startLanServer({ root, preferredPort = 47652, host = '0.0.0.0', listenerOptions = {}, deviceStorePath = null, pollDevice, inventoryIntervalMs = 15000, releaseRequest }) {
  if (!Number.isInteger(preferredPort) || preferredPort < 1024 || preferredPort > 65535) throw new Error('Server port must be an integer from 1024 to 65535.');
  const base = path.resolve(root);
  if (!fs.existsSync(path.join(base, 'index.html'))) throw new Error('The bundled dashboard is missing. Reinstall the app.');
  let listener;
  const checkRelease = createReleaseChecker(version, releaseRequest);
  const devicePoller = createDevicePoller();
  const inventory = createDeviceInventory({ file: deviceStorePath, poll: pollDevice || (ip => devicePoller.poll(ip)), intervalMs: inventoryIntervalMs });
  const server = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    const foreignOrigin = req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`);
    if (req.method === 'POST' && ['/api/devices', '/api/devices/refresh', '/api/devices/layout'].includes(pathname)) {
      res.setHeader('Content-Type', 'application/json');
      if (foreignOrigin) { res.writeHead(403); res.end('{}'); return; }
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) { res.writeHead(415); res.end('{}'); return; }
      let size = 0, oversized = false; const chunks = [];
      req.on('data', chunk => { size += chunk.length; if (size > 65536) oversized = true; else chunks.push(chunk); });
      req.on('end', () => {
        if (oversized) { res.writeHead(413); res.end('{}'); return; }
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if (pathname === '/api/devices') inventory.add(body.devices || [body], { legacyImport: body.legacyImport === true });
          else if (pathname === '/api/devices/layout') inventory.layout(body);
          else void inventory.refresh();
          res.end(JSON.stringify(inventory.snapshot()));
        } catch (error) { res.writeHead(error.statusCode === 409 ? 409 : error instanceof RangeError || error instanceof SyntaxError ? 400 : 503); res.end(JSON.stringify({ error: error.message })); }
      });
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    if (pathname === '/api/updates') {
      res.setHeader('Content-Type', 'application/json');
      if (foreignOrigin) { res.writeHead(403); res.end('{}'); return; }
      if (req.method === 'HEAD') { res.end(); return; }
      void checkRelease().then(result => res.end(JSON.stringify(result))).catch(error => { res.writeHead(502); res.end(JSON.stringify({ error: error.message })); });
      return;
    }
    if (pathname === '/api/devices') {
      res.setHeader('Content-Type', 'application/json');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(inventory.snapshot()));
      return;
    }
    if (pathname === '/api/server-info') {
      res.setHeader('Content-Type', 'application/json');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(addresses(server.address().port, host)));
      return;
    }
    if (pathname === '/api/signals') {
      res.setHeader('Content-Type', 'application/json');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(listener ? listener.snapshot() : { available: false }));
      return;
    }
    if (pathname === '/api/devices/poll') {
      res.setHeader('Content-Type', 'application/json');
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) { res.writeHead(403); res.end('{}'); return; }
      if (!listener || req.method === 'HEAD') { res.writeHead(503); res.end(); return; }
      const ip = new URL(req.url, 'http://localhost').searchParams.get('ip') || '';
      if (!validTarget(ip)) { res.writeHead(400); res.end('{}'); return; }
      // Compatibility reads return the shared snapshot; a browser never polls a node itself.
      const result = inventory.snapshot().info[ip];
      if (!result) { res.writeHead(404); res.end(JSON.stringify({ error: 'Add this device to the shared server inventory.' })); return; }
      res.end(JSON.stringify(result));
      return;
    }
    if (pathname === '/api/signals/channel') {
      res.setHeader('Content-Type', 'application/json');
      const query = new URL(req.url, 'http://localhost').searchParams;
      try {
        const universe = query.get('universe'), channel = query.get('channel');
        if (!/^\d+$/.test(universe || '') || !/^\d+$/.test(channel || '')) throw new RangeError('Universe and channel must be whole numbers.');
        const result = listener ? listener.channelValue(query.get('protocol'), Number(universe), Number(channel)) : { available: false };
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(result));
      } catch (error) {
        res.writeHead(error instanceof RangeError ? 400 : 500);
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: error instanceof RangeError ? error.message : 'Channel data unavailable.' }));
      }
      return;
    }
    const file = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(base + path.sep) || pathname.includes('\\') || pathname.includes('\0')) { res.writeHead(403); res.end(); return; }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(file);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    });
  });
  server.requestTimeout = 15000;
  for (let port = preferredPort; port <= Math.min(preferredPort + 99, 65535); port++) {
    try {
      await new Promise((resolve, reject) => {
        const onError = error => { server.removeListener('listening', onListen); reject(error); };
        const onListen = () => { server.removeListener('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListen);
        server.listen({ port, host, exclusive: true });
      });
      const localHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '[::1]' : host.includes(':') ? `[${host}]` : host;
      listener = createSignalListener(listenerOptions);
      await listener.ready;
      inventory.start();
      server.on('close', () => { inventory.close(); listener.close(); });
      return { server, port, url: `http://${localHost}:${port}`, info: () => addresses(port, host) };
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No available server port was found. Set NETWORK_ANALYZER_PORT to another port.');
}

module.exports = { startLanServer };
