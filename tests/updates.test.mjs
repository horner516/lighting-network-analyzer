import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, checkLatestRelease } from '../lib/updates.ts';

test('release versions compare numerically and ignore equal or older releases', () => {
  assert.equal(isNewerVersion('v0.1.10', '0.1.9'), true);
  assert.equal(isNewerVersion('v1.0.0', '0.99.99'), true);
  assert.equal(isNewerVersion('v0.1.1', '0.1.1'), false);
  assert.equal(isNewerVersion('v0.1.0', '0.1.1'), false);
  assert.throws(() => isNewerVersion('latest', '0.1.1'));
});

test('update check returns newer version without using credentials or arbitrary URLs', async () => {
  const result = await checkLatestRelease('0.1.1', new AbortController().signal, async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/horner516/lighting-network-analyzer/releases/latest');
    assert.equal(options.credentials, 'omit');
    return new Response(JSON.stringify({ tag_name: 'v0.1.2', html_url: 'https://untrusted.example' }));
  });
  assert.deepEqual(result, { version:'v0.1.2', newer:true });
});

test('missing releases and rate limits are reported rather than claiming up to date', async () => {
  await assert.rejects(checkLatestRelease('0.1.1', new AbortController().signal, async () => new Response('', { status:404 })), /No published release/);
  await assert.rejects(checkLatestRelease('0.1.1', new AbortController().signal, async () => new Response('', { status:403 })), /limiting update checks/);
});
