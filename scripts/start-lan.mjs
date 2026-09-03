import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const PORT = process.env.NETWORK_ANALYZER_PORT || '47652';
const HOST = process.env.NETWORK_ANALYZER_HOST || '0.0.0.0';

function getVinextExecutable() {
  const candidates = [
    join(projectRoot, 'node_modules', 'vinext', 'dist', 'cli.js'),
  ];

  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error('vinext binary not found. Run `pnpm install` from the project root first.');
  }

  return found;
}

function startServer() {
  if (!/^\d+$/.test(PORT) || Number(PORT) < 1024 || Number(PORT) > 65535) {
    throw new Error('NETWORK_ANALYZER_PORT must be an integer from 1024 to 65535.');
  }
  const command = getVinextExecutable();
  const args = [command, 'dev', '--hostname', HOST, '--port', PORT];

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: { ...process.env, NETWORK_ANALYZER_PORT: PORT, NETWORK_ANALYZER_HOST: HOST, PORT },
  });
  child.on('message', message => process.send?.(message));
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

startServer();
