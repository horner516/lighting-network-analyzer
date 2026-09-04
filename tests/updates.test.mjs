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

test('dashboard asks its own server for the installed version and trusted download link', async () => {
  const result = await checkLatestRelease(new AbortController().signal, async (url, options) => {
    assert.equal(url, '/api/updates');
    assert.equal(options.credentials, 'same-origin');
    return Response.json({ currentVersion: '0.1.1', version: 'v0.1.2', newer: true, downloadUrl: 'https://github.com/horner516/lighting-network-analyzer/releases/latest' });
  });
  assert.equal(result.version, 'v0.1.2'); assert.equal(result.newer, true); assert.equal(result.currentVersion, '0.1.1');
});

test('missing releases and rate limits are reported rather than claiming up to date', async () => {
  await assert.rejects(checkLatestRelease(new AbortController().signal, async () => Response.json({error:'No published release'}, { status:502 })), /No published release/);
  await assert.rejects(checkLatestRelease(new AbortController().signal, async () => Response.json({error:'GitHub is limiting update checks'}, { status:502 })), /limiting update checks/);
});

test('dashboard rejects arbitrary download URLs and inconsistent comparisons', async () => {
  const data = {currentVersion:'0.1.7', version:'v0.1.8', newer:true, downloadUrl:'https://untrusted.example'};
  await assert.rejects(checkLatestRelease(new AbortController().signal, async () => Response.json(data)), /invalid update response/);
  data.downloadUrl = 'https://github.com/horner516/lighting-network-analyzer/releases/latest'; data.newer = false;
  await assert.rejects(checkLatestRelease(new AbortController().signal, async () => Response.json(data)), /inconsistent/);
});

import { createReleaseChecker } from '../lib/release-check.cjs';
test('server compares stable releases numerically, ignores supplied URLs, and coalesces simultaneous requests', async () => {
  let calls = 0;
  const check = createReleaseChecker('0.1.7', async (url, options) => {
    calls++; assert.equal(url, 'https://api.github.com/repos/horner516/lighting-network-analyzer/releases/latest');
    assert.ok(options.signal); assert.equal(options.headers.Authorization, undefined);
    return Response.json({ tag_name:'v0.1.10', html_url:'https://untrusted.example' });
  });
  const [a,b] = await Promise.all([check(),check()]);
  assert.equal(calls,1); assert.deepEqual(a,b); assert.equal(a.newer,true);
  assert.equal(a.downloadUrl,'https://github.com/horner516/lighting-network-analyzer/releases/latest');
  for (const tag of ['v0.1.7','v0.1.6']) assert.equal((await createReleaseChecker('0.1.7', async () => Response.json({tag_name:tag}))()).newer,false);
});
test('server reports offline, rate-limited, absent, malformed and prerelease responses', async () => {
  for (const status of [403,429,404,500]) await assert.rejects(createReleaseChecker('0.1.7', async () => new Response('',{status}))());
  for (const value of [{tag_name:'bad'}, {tag_name:'v0.1.8',prerelease:true}, {tag_name:'v0.1.8',draft:true}, null]) await assert.rejects(createReleaseChecker('0.1.7',async () => Response.json(value))());
  await assert.rejects(createReleaseChecker('0.1.7',async () => {throw Error('offline');})(),/server could not reach GitHub/);
});
