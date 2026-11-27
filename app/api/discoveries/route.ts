import { NextResponse } from 'next/server';
import { getCachedDiscoveries } from '@/lib/live';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json({ discoveries: await getCachedDiscoveries(), generatedAt: new Date().toISOString() }); }
  catch { return NextResponse.json({ discoveries: [], degraded: true }, { status: 200 }); }
}
