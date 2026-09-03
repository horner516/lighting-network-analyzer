export const releasePage = 'https://github.com/horner516/lighting-network-analyzer/releases/latest';
const releaseApi = 'https://api.github.com/repos/horner516/lighting-network-analyzer/releases/latest';

export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (version: string) => {
    const match = /^v?(\d{1,9})\.(\d{1,9})\.(\d{1,9})(?:\+[\w.-]+)?$/.exec(version);
    if (!match) throw new Error('The release version could not be compared. Open GitHub to check it.');
    return match.slice(1, 4).map(Number);
  };
  const next = parse(latest), installed = parse(current);
  for (let index = 0; index < 3; index++) {
    if (next[index] !== installed[index]) return next[index] > installed[index];
  }
  return false;
}

export async function checkLatestRelease(current: string, signal: AbortSignal, request: typeof fetch = fetch) {
  const response = await request(releaseApi, { signal, cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/vnd.github+json' } });
  if (response.status === 404) throw new Error('No published release is available yet.');
  if (response.status === 403 || response.status === 429) throw new Error('GitHub is limiting update checks. Try again later or open GitHub.');
  if (!response.ok) throw new Error('GitHub could not be reached. Try again or open GitHub.');
  const release = await response.json() as { tag_name?: unknown; draft?: unknown; prerelease?: unknown } | null;
  if (!release || typeof release.tag_name !== 'string' || release.draft || release.prerelease) throw new Error('No stable release version was returned. Open GitHub to check.');
  return { version: release.tag_name, newer: isNewerVersion(release.tag_name, current) };
}
