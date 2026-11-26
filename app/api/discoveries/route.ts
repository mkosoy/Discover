import { NextResponse } from 'next/server';
import { getDiscoveries } from '@/lib/live';
export const revalidate = 120;
export async function GET() {
  try { return NextResponse.json({ discoveries: await getDiscoveries(), generatedAt: new Date().toISOString() }); }
  catch { return NextResponse.json({ discoveries: [], degraded: true }, { status: 200 }); }
}
