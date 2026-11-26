import { NextResponse } from 'next/server';
import { getInvestigations } from '@/lib/live';
export const dynamic = 'force-dynamic';

// Editorial content tolerates minutes of staleness; some upstream calls are throttled
// (ADS-B sampling is rate-limited to ~1/sec), so a cold fill can take 15s+. Serve any
// stale payload instantly and regenerate in the background instead of blocking the rail.
let cache: { at: number; payload: any } = { at: 0, payload: null };
let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const payload = { investigations: await getInvestigations(), generatedAt: new Date().toISOString() };
    cache = { at: Date.now(), payload };
  } catch {
    // keep stale cache
  } finally {
    refreshing = false;
  }
}

export async function GET() {
  const fresh = cache.payload && Date.now() - cache.at < 600000;
  if (fresh) return NextResponse.json({ ...cache.payload, cached: true });
  if (cache.payload) {
    refresh();
    return NextResponse.json({ ...cache.payload, cached: true, stale: true });
  }
  try {
    await refresh();
    if (cache.payload) return NextResponse.json(cache.payload);
    return NextResponse.json({ investigations: [], degraded: true }, { status: 200 });
  } catch {
    return NextResponse.json({ investigations: [], degraded: true }, { status: 200 });
  }
}
