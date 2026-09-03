import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const executable = resolve(process.argv[2]);
const output = resolve(mkdtempSync(resolve(tmpdir(), 'lna-smoke-')), 'result.json');
const child = spawn(executable, [], { env: { ...process.env, LNA_SMOKE_TEST: '1', LNA_SMOKE_RESULT: output }, stdio: 'inherit' });
const timeout = setTimeout(() => { child.kill(); process.exitCode = 1; }, 30000);
child.on('error', error => { clearTimeout(timeout); console.error(error); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timeout);
  if (code !== 0 || !existsSync(output)) { console.error('Packaged startup failed:', code); process.exitCode = 1; return; }
  const result = JSON.parse(readFileSync(output, 'utf8'));
  if (!result.ok || !result.port) { process.exitCode = 1; return; }
  console.log('Packaged startup passed:', result);
});
