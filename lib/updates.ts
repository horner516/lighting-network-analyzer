export const releasePage = 'https://github.com/horner516/lighting-network-analyzer/releases/latest';

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

export async function checkLatestRelease(signal: AbortSignal, request: typeof fetch = fetch) {
  const response = await request('/api/updates', { signal, cache: 'no-store', credentials: 'same-origin' });
  const result = await response.json().catch(() => null) as { error?: string; currentVersion?: string; version?: string; newer?: boolean; downloadUrl?: string } | null;
  if (!response.ok) throw new Error(result?.error || 'Update check unavailable. Open the updated local server or GitHub downloads.');
  if (!result || typeof result.currentVersion !== 'string' || typeof result.version !== 'string' || typeof result.newer !== 'boolean' || result.downloadUrl !== releasePage) throw new Error('The server returned an invalid update response.');
  if (isNewerVersion(result.version, result.currentVersion) !== result.newer) throw new Error('The server returned inconsistent version information.');
  return { currentVersion: result.currentVersion, version: result.version, newer: result.newer, downloadUrl: releasePage };
}
