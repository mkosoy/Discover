import { NextResponse } from 'next/server';
import { getInvestigations } from '@/lib/live';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json({ investigations: await getInvestigations(), generatedAt: new Date().toISOString() }); }
  catch { return NextResponse.json({ investigations: [], degraded: true }, { status: 200 }); }
}
