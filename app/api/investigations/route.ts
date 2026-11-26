import { NextResponse } from 'next/server';
import { getInvestigations } from '@/lib/live';
export const dynamic = 'force-dynamic';

// Editorial content tolerates a few minutes of staleness; upstream calls take ~2s otherwise.
// Cache the payload in-process and serve stale-while-regenerating style responses.
let cache: { at: number; payload: any } = { at: 0, payload: null };

export async function GET() {
  try {
    if (cache.payload && Date.now() - cache.at < 600000) return NextResponse.json({ ...cache.payload, cached: true });
    const payload = { investigations: await getInvestigations(), generatedAt: new Date().toISOString() };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  }
  catch {
    if (cache.payload) return NextResponse.json({ ...cache.payload, cached: true, degraded: true });
    return NextResponse.json({ investigations: [], degraded: true }, { status: 200 });
  }
}
