import { NextResponse } from 'next/server';

async function json<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic') ?? 'context';
  const label = url.searchParams.get('label') ?? 'this place';
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const [weather, place] = await Promise.all([
    Number.isFinite(lat) && Number.isFinite(lon) ? json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,cloud_cover,weather_code,wind_speed_10m&timezone=auto`) : null,
    Number.isFinite(lat) && Number.isFinite(lon) ? json<any>(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`) : null
  ]);
  const current = weather?.current;
  const t = topic.toLowerCase();
  const facts: { label: string; value: string; kind: 'observed' | 'verified' | 'interpretation' | 'question' }[] = [];
  if (current) {
    facts.push({ label: 'Cloud cover', value: `${Math.round(current.cloud_cover)}%`, kind: 'observed' });
    facts.push({ label: 'Wind', value: `${Math.round(current.wind_speed_10m)} km/h`, kind: 'observed' });
    facts.push({ label: 'Feels like', value: `${Math.round(current.apparent_temperature)}°C`, kind: 'observed' });
  } else facts.push({ label: 'Weather', value: 'Unavailable', kind: 'question' });
  const placeName = [place?.locality, place?.principalSubdivision, place?.countryName].filter(Boolean).join(', ');
  facts.push({ label: 'Place context', value: placeName || label, kind: placeName ? 'verified' : 'question' });

  let insight = 'This layer grounds the story in current local conditions rather than treating the original signal as self-explanatory.';
  if (t.includes('aurora') || t.includes('cloud')) insight = current ? `Cloud cover is the immediate visibility constraint: ${Math.round(current.cloud_cover)}% coverage means aurora or sky observation is ${current.cloud_cover > 70 ? 'unlikely without a break in clouds' : current.cloud_cover > 30 ? 'possible only through gaps' : 'more favorable, darkness permitting'}.` : insight;
  if (t.includes('wind') || t.includes('fire')) insight = current ? `Wind is a real measured variable here (${Math.round(current.wind_speed_10m)} km/h), but Elsewhere does not infer fire spread without fuel, humidity and authoritative incident data.` : insight;
  if (t.includes('tsunami')) insight = 'A tsunami cannot be inferred from an earthquake alone. The next evidence needed is an official tsunami bulletin, sea-level gauge anomaly or verified coastal observation.';
  if (t.includes('camera')) insight = 'No direct camera feed is assumed. A useful next step is finding an authorized local camera or official stream, then comparing it with the measured conditions shown here.';
  if (t.includes('launch') || t.includes('weather')) insight = current ? `Launch constraints are weather-sensitive: current wind is ${Math.round(current.wind_speed_10m)} km/h and precipitation is ${current.precipitation ?? 0} mm, but launch Go/No-Go authority belongs to the mission operator.` : insight;
  if (t.includes('pass') || t.includes('trajectory')) insight = 'Orbital visibility depends on observer darkness, satellite illumination, altitude and local horizon geometry; position alone does not prove naked-eye visibility.';

  facts.push({ label: 'Insight', value: insight, kind: 'interpretation' });
  facts.push({ label: 'Next evidence', value: 'Independent local observation', kind: 'question' });
  return NextResponse.json({ lens: { topic, place: placeName || label, facts, retrievedAt: new Date().toISOString() } });
}
