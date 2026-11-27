import { NextResponse } from 'next/server';
import { getInvestigations, riverServedColdAt } from '@/lib/live';
export const dynamic = 'force-dynamic';

// Editorial content tolerates minutes of staleness; some upstream calls are throttled
// (ADS-B sampling is rate-limited to ~1/sec), so a cold fill can take 15s+. Serve any
// stale payload instantly and regenerate in the background instead of blocking the rail.
let cache: { at: number; payload: any; degradedRivers?: boolean } = { at: 0, payload: null };
let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const startedAt = Date.now();
    const payload = { investigations: await getInvestigations(), generatedAt: new Date().toISOString() };
    // If this generation ran while the river cache was still cold, the payload
    // is missing evidence that arrives seconds later — don't freeze it for the
    // full TTL; treat it as stale almost immediately so the next request
    // triggers a regeneration with the gauges included.
    const degradedRivers = riverServedColdAt >= startedAt - 1000;
    cache = { at: Date.now(), payload, degradedRivers };
  } catch {
    // keep stale cache
  } finally {
    refreshing = false;
  }
}

export async function GET() {
  const ttl = cache.degradedRivers ? 45000 : 600000;
  const fresh = cache.payload && Date.now() - cache.at < ttl;
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
