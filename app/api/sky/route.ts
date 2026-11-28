import { NextResponse } from 'next/server';
import { getGlobalAircraft } from '@/lib/live';
export const dynamic = 'force-dynamic';

// Live global air traffic for the globe shimmer layer. Shares the in-process OpenSky
// snapshot with the airborne-now card, stride-sampled to ~2600 positions for payload size.
export async function GET() {
  const positions = await getGlobalAircraft();
  const stride = Math.max(1, Math.ceil(positions.length / 2600));
  const sampled = positions.filter((_, i) => i % stride === 0).map(p => ({ lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 }));
  return NextResponse.json({ positions: sampled, count: sampled.length, total: positions.length, generatedAt: new Date().toISOString(), source: 'OpenSky Network (anonymous, real-time ADS-B)' });
}
