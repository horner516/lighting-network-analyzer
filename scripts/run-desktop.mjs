import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require.resolve('electron');
const projectRoot = join(process.cwd(), '');
const port = process.env.NETWORK_ANALYZER_PORT || '47652';
const host = process.env.NETWORK_ANALYZER_HOST || '0.0.0.0';

spawn(electronPath, [join(projectRoot, 'electron', 'main.cjs')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NETWORK_ANALYZER_PORT: port,
    NETWORK_ANALYZER_HOST: host,
  },
});
