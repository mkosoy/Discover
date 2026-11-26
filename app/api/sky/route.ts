import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// Live global air traffic, proxied keyless from OpenSky and stride-sampled to ~2600 airborne aircraft.
// Cached in-process for 45 seconds — anonymous OpenSky is rate-limited and positions a minute
// old are still effectively live at globe scale.
let cache: { at: number; payload: any } = { at: 0, payload: null };

export async function GET() {
  if (cache.payload && Date.now() - cache.at < 45000) return NextResponse.json({ ...cache.payload, cached: true });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch('https://opensky-network.org/api/states/all', { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) throw new Error('opensky unavailable');
    const data = await res.json();
    const airborne = (data.states ?? [])
      .filter((row: any[]) => Number.isFinite(row?.[5]) && Number.isFinite(row?.[6]) && row?.[8] !== true);
    const stride = Math.max(1, Math.ceil(airborne.length / 2600));
    const positions = airborne
      .filter((_: any[], i: number) => i % stride === 0)
      .map((row: any[]) => ({ lat: Math.round(row[6] * 100) / 100, lon: Math.round(row[5] * 100) / 100 }));
    const payload = { positions, count: positions.length, generatedAt: new Date().toISOString(), source: 'OpenSky Network (anonymous, real-time ADS-B)' };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch {
    if (cache.payload) return NextResponse.json({ ...cache.payload, cached: true, degraded: true });
    return NextResponse.json({ positions: [], count: 0, degraded: true });
  }
}
