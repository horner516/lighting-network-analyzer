import { createReleaseChecker } from '@/lib/release-check.cjs';
import { version } from '../../../package.json';

const checkRelease = createReleaseChecker(version);
export async function GET() {
  try { return Response.json(await checkRelease(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Update check failed.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
}
