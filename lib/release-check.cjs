const releasePage = 'https://github.com/horner516/lighting-network-analyzer/releases/latest';
const releaseApi = 'https://api.github.com/repos/horner516/lighting-network-analyzer/releases/latest';

function parseVersion(value) {
  const match = typeof value === 'string' && /^v?(\d{1,9})\.(\d{1,9})\.(\d{1,9})(?:\+[\w.-]+)?$/.exec(value);
  if (!match) throw Error('GitHub returned an unsupported release version. Open downloads to check manually.');
  return match.slice(1).map(Number);
}

function createReleaseChecker(currentVersion, request = fetch) {
  let pending;
  return function check() {
    if (pending) return pending;
    pending = (async () => {
      let response;
      try {
        response = await request(releaseApi, { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lux-Link-update-check' } });
      } catch { throw Error('The server could not reach GitHub. Check the server’s internet connection and try again.'); }
      if (response.status === 404) throw Error('No published release is available yet.');
      if (response.status === 403 || response.status === 429) throw Error('GitHub is limiting update checks. Try again later or open downloads.');
      if (!response.ok) throw Error('GitHub could not complete the update check. Try again later.');
      const release = await response.json();
      if (!release || release.draft || release.prerelease) throw Error('No stable release was returned by GitHub.');
      const latest = parseVersion(release.tag_name), current = parseVersion(currentVersion);
      const difference = latest.findIndex((part, index) => part !== current[index]);
      return { currentVersion, version: release.tag_name, newer: difference >= 0 && latest[difference] > current[difference], downloadUrl: releasePage };
    })().finally(() => { pending = undefined; });
    return pending;
  };
}
module.exports = { createReleaseChecker };
