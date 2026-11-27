import { NextResponse } from 'next/server';
import { parseGdacsItems } from '@/lib/live';

export const dynamic = 'force-dynamic';

type LayerPoint = { lat: number; lon: number; mag?: number; kind?: string };

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

let cache: { at: number; data: any } = { at: 0, data: null };

async function buildLayers() {
  const [quakes, eonet, gdacsXml] = await Promise.all([
    fetchJson<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson'),
    fetchJson<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=40'),
    fetchText('https://www.gdacs.org/xml/rss.xml'),
  ]);

  const quakePoints: LayerPoint[] = (quakes?.features ?? [])
    .map((feature: any) => ({
      lat: Math.round(feature.geometry.coordinates[1] * 10) / 10,
      lon: Math.round(feature.geometry.coordinates[0] * 10) / 10,
      mag: feature.properties.mag,
      ageMinutes: Math.max(0, Math.round((Date.now() - feature.properties.time) / 60000)),
    }))
    .filter((point: LayerPoint) => Number.isFinite(point.lat) && Number.isFinite(point.lon));

  const fires: LayerPoint[] = [];
  const storms: LayerPoint[] = [];
  for (const event of eonet?.events ?? []) {
    const geometry = event.geometry?.[event.geometry.length - 1];
    if (!geometry?.coordinates) continue;
    const [lon, lat] = geometry.type === 'Point' ? geometry.coordinates : geometry.coordinates?.[0]?.[0] ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const category = (event.categories?.[0]?.title ?? '').toLowerCase();
    const point = { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10, kind: category };
    if (category.includes('fire')) fires.push(point);
    else if (category.includes('storm') || category.includes('cyclone')) storms.push(point);
  }

  const gdacsItems = parseGdacsItems(gdacsXml).filter((item: any) => Date.now() - new Date(item.published).getTime() < 1000 * 60 * 60 * 96);
  for (const item of gdacsItems) {
    const point = { lat: Math.round(item.lat * 10) / 10, lon: Math.round(item.lon * 10) / 10, kind: item.eventType };
    if (item.eventType === 'WF') fires.push(point);
    else if (item.eventType === 'TC' || item.eventType === 'FL' || item.eventType === 'TS') storms.push(point);
  }

  const volcanoes: LayerPoint[] = gdacsItems
    .filter((item: any) => item.eventType === 'VO')
    .map((item: any) => ({ lat: Math.round(item.lat * 10) / 10, lon: Math.round(item.lon * 10) / 10, kind: 'VO' }));

  return {
    quakes: quakePoints,
    fires: fires.slice(0, 60),
    storms: storms.slice(0, 40),
    volcanoes: volcanoes.slice(0, 20),
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const now = Date.now();
  if (!cache.data || now - cache.at > 300000) {
    const data = await buildLayers();
    if (data.quakes.length || data.fires.length || data.storms.length) {
      cache = { at: now, data };
    }
  }
  return NextResponse.json(cache.data ?? { quakes: [], fires: [], storms: [], volcanoes: [] }, {
    headers: { 'Cache-Control': 'public, max-age=240' },
  });
}
