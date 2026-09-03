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
    join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'vinext.cmd' : 'vinext'),
    join(projectRoot, 'node_modules', '.bin', 'vinext'),
  ];

  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error('vinext binary not found. Run `pnpm install` from the project root first.');
  }

  return found;
}

function startServer() {
  const command = getVinextExecutable();
  const args = ['dev', '--hostname', HOST, '--port', PORT];
  const shell = process.platform === 'win32';

  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell,
    env: { ...process.env, NETWORK_ANALYZER_PORT: PORT, NETWORK_ANALYZER_HOST: HOST, PORT },
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      process.exit(code ?? 1);
    }
  });
}

startServer();
