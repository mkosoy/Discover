import type { Discovery, Investigation } from './types';
import { ago } from './time';

const now = () => new Date().toISOString();
const src = (label: string, url: string) => ({ label, url, retrievedAt: now() });
async function json<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, next: { revalidate: 180 } });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}

export async function getDiscoveries(): Promise<Discovery[]> {
  const retrieved = now();
  const [iss, quakes, eonet, kp, launches, tides, tokyo] = await Promise.all([
    json<any>('https://api.wheretheiss.at/v1/satellites/25544'),
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'),
    json<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=10'),
    json<any[]>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
    json<any>('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=4&mode=detailed'),
    json<any>('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=9414290&product=water_level&datum=MLLW&time_zone=gmt&units=english&format=json'),
    json<any>('https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto')
  ]);
  const out: Discovery[] = [];
  if (iss?.latitude != null) out.push({
    id: 'iss-over-earth', template: 'orbit', title: 'The ISS is crossing the planet in silence',
    kicker: 'Live orbital pass', visual: 'nasa-live', score: 96, freshness: 'live now', altitude: iss.altitude,
    location: { lat: iss.latitude, lon: iss.longitude, label: `${Number(iss.latitude).toFixed(1)}°, ${Number(iss.longitude).toFixed(1)}°` },
    summary: 'A football-field-sized laboratory is moving about 7.66 km every second. The position is live; the video is an official NASA stream when available.',
    facts: [
      { label: 'Velocity', value: `${Math.round(iss.velocity).toLocaleString()} km/h`, kind: 'observed' },
      { label: 'Altitude', value: `${Math.round(iss.altitude)} km`, kind: 'observed' },
      { label: 'Position', value: 'Updated seconds ago', kind: 'observed' }
    ],
    sources: [src('Open Notify / Where the ISS at?', 'https://wheretheiss.at/'), src('NASA Live', 'https://www.nasa.gov/live/')],
    related: ['Next visible pass', 'Aurora watch', 'Upcoming launches']
  });
  const q = quakes?.features?.sort((a: any, b: any) => (b.properties?.mag ?? 0) - (a.properties?.mag ?? 0))[0];
  if (q) {
    const [lon, lat, depth] = q.geometry.coordinates;
    out.push({ id: `quake-${q.id}`, template: 'geology', title: 'A significant earthquake just reshaped the seismic map', kicker: 'USGS live event', visual: 'seismic', score: 82 + Math.min(14, q.properties.mag * 2), freshness: ago(q.properties.time), location: { lat, lon, label: q.properties.place }, summary: `A magnitude ${q.properties.mag.toFixed(1)} earthquake was recorded near ${q.properties.place}. The shake is real observed data; broader impact is deliberately left as an open question until corroborated.`, facts: [
      { label: 'Magnitude', value: q.properties.mag.toFixed(1), kind: 'observed' }, { label: 'Depth', value: `${Math.round(depth)} km`, kind: 'observed' }, { label: 'Reports', value: `${q.properties.felt ?? 0} felt reports`, kind: 'verified' }, { label: 'Impact', value: 'Still unknown', kind: 'question' }
    ], sources: [src('USGS earthquake feed', q.properties.url)], related: ['Aftershock pattern', 'Tsunami bulletins', 'Regional recovery'] });
  }
  const evt = eonet?.events?.find((e: any) => e.geometry?.length);
  if (evt) {
    const geom = evt.geometry.at(-1);
    const [lon, lat] = geom.coordinates;
    const cat = evt.categories?.[0]?.title ?? 'Natural event';
    out.push({ id: `eonet-${evt.id}`, template: cat.toLowerCase().includes('fire') ? 'wildfire' : 'atmosphere', title: `${cat} unfolding in ${evt.title}`, kicker: 'NASA EONET natural event', visual: cat.toLowerCase().includes('fire') ? 'fire' : 'aurora', score: 78, freshness: ago(geom.date), location: { lat, lon, label: evt.title }, summary: `${evt.title} is being tracked in NASA's open natural-event catalog. Elsewhere combines the event position with weather and source context rather than pretending satellite imagery is live.`, facts: [
      { label: 'Category', value: cat, kind: 'verified' }, { label: 'Last geometry', value: ago(geom.date), kind: 'observed' }, { label: 'Live imagery', value: 'Not assumed', kind: 'question' }
    ], sources: [src('NASA EONET', evt.link ?? 'https://eonet.gsfc.nasa.gov/')], related: ['Wind direction', 'Nearby cameras', 'Historical comparison'] });
  }
  const latestKp = Array.isArray(kp?.[0]) ? kp.filter(Array.isArray).slice(1).at(-1) : kp?.at(-1);
  if (latestKp) out.push({ id: 'aurora-watch', template: 'atmosphere', title: 'Aurora conditions are being measured above the polar night', kicker: 'NOAA space weather', visual: 'aurora', score: 74 + Number(latestKp?.Kp ?? latestKp?.[1] ?? 0) * 3, freshness: 'updated minutes ago', location: { lat: 64.2, lon: -21.1, label: 'Iceland / polar oval' }, summary: 'The planetary K index is a real-time geomagnetic measurement. Aurora visibility still depends on darkness and cloud cover, so Elsewhere labels the opportunity as conditional rather than a promise.', facts: [
    { label: 'Kp index', value: String(latestKp?.Kp ?? latestKp?.[1] ?? "—"), kind: 'observed' }, { label: 'Visibility', value: 'Depends on clouds and darkness', kind: 'interpretation' }, { label: 'Camera match', value: 'Needs local verification', kind: 'question' }
  ], sources: [src('NOAA SWPC K-index', 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')], related: ['Cloud cover', 'Northern webcams', 'Solar wind speed'] });
  const tide = tides?.data?.[0];
  if (tide) out.push({ id: 'sf-tide-pulse', template: 'ocean', title: 'San Francisco Bay is breathing with the tide', kicker: 'NOAA coastal observation', visual: 'ocean', score: 68, freshness: ago(tide.t), location: { lat: 37.8, lon: -122.47, label: 'San Francisco Bay' }, summary: 'A tide gauge is measuring the bay right now. Elsewhere turns a small operational observation into a planetary rhythm: moon, gravity, coastlines and cities moving together.', facts: [
    { label: 'Water level', value: `${tide.v} ft`, kind: 'observed' }, { label: 'Station', value: 'NOAA 9414290', kind: 'verified' }, { label: ' Coastal impact', value: 'Depends on local terrain', kind: 'interpretation' }
  ], sources: [src('NOAA CO-OPS', 'https://tidesandcurrents.noaa.gov/')], related: ['Golden Gate currents', 'Storm surge', 'Coastal cameras'] });
  if (tokyo?.current) out.push({ id: 'tokyo-waking', template: 'city', title: 'Tokyo is moving through its morning transition', kicker: 'Open-Meteo city pulse', visual: 'city', score: 66, freshness: 'current conditions', location: { lat: 35.68, lon: 139.69, label: 'Tokyo' }, summary: 'Weather, sunrise and local time combine into a quiet portrait of a megacity changing state. Transit and camera layers can later make this portrait richer.', facts: [
    { label: 'Temperature', value: `${Math.round(tokyo.current.temperature_2m)}°C`, kind: 'observed' }, { label: 'Wind', value: `${Math.round(tokyo.current.wind_speed_10m)} km/h`, kind: 'observed' }, { label: 'Sunrise', value: tokyo.daily?.sunrise?.[0]?.slice(11) ?? '—', kind: 'verified' }
  ], sources: [src('Open-Meteo', 'https://open-meteo.com/')], related: ['Transit pulse', 'City cameras', 'Night lights'] });
  const launch = launches?.results?.[0];
  if (launch) out.push({ id: `launch-${launch.id}`, template: 'launch', title: launch.name, kicker: 'Upcoming space mission', visual: 'launch', score: 70, freshness: launch.net ? ago(launch.net).replace(' ago','') : 'scheduled', location: { lat: launch.pad?.latitude ?? 28.6, lon: launch.pad?.longitude ?? -80.6, label: launch.pad?.location?.name ?? launch.pad?.name ?? 'Launch complex' }, summary: `${launch.name} is scheduled from ${launch.pad?.name ?? 'a launch complex'}. Countdowns can change, so Elsewhere distinguishes the published schedule from confirmation.`, facts: [
    { label: 'Window', value: launch.net ? new Date(launch.net).toLocaleString() : 'TBD', kind: 'verified' }, { label: 'Status', value: launch.status?.name ?? 'Unknown', kind: 'verified' }, { label: 'Provider', value: launch.launch_service_provider?.name ?? 'Unknown', kind: 'verified' }
  ], sources: [src('Launch Library 2', 'https://thespacedevs.com/llapi')], related: ['Mission trajectory', 'Weather constraints', 'Pad cameras'] });
  return out.sort((a, b) => b.score - a.score).map(d => ({ ...d, retrieved } as Discovery));
}

export async function getInvestigations(): Promise<Investigation[]> {
  const [quake, reports, news, eonet] = await Promise.all([
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'),
    json<any>('https://api.reliefweb.int/v1/reports?appname=elsewhere-discover&limit=5&profile=list&sort[]=date:desc'),
    json<any>('https://api.gdeltproject.org/api/v2/doc/doc?query=earthquake%20OR%20volcano%20OR%20flood&mode=ArtList&maxrecords=8&format=json&sort=HybridRel'),
    json<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=6')
  ]);
  const q = quake?.features?.[0];
  const out: Investigation[] = [];
  if (q) {
    const [lon, lat, depth] = q.geometry.coordinates;
    const reliefCount = reports?.data?.length ?? 0;
    const coverage = news?.articles?.length ?? 0;
    out.push({ id: 'seismic-ripple', title: 'What follows a significant earthquake?', dek: 'A evidence-first reconstruction combining USGS observations, humanitarian reporting and global media attention.', status: reliefCount ? 'developing' : 'uncertain', location: { lat, lon, label: q.properties.place }, updatedAt: new Date(q.properties.time).toISOString(), confidence: coverage && reliefCount ? 74 : 52, metrics: [
      { label: 'Magnitude', value: q.properties.mag?.toFixed(1) ?? '—' }, { label: 'Depth', value: `${Math.round(depth)} km` }, { label: 'Media signals', value: String(coverage), delta: 'last refresh' }, { label: 'Relief reports', value: String(reliefCount), delta: 'global sample' }
    ], evidence: [
      { kind: 'observed', text: `USGS recorded magnitude ${q.properties.mag?.toFixed(1)} at ${Math.round(depth)} km depth near ${q.properties.place}.`, source: q.properties.url },
      { kind: 'verified', text: `${coverage} recent GDELT-matched articles mention major earth hazards; this is attention, not damage measurement.` },
      { kind: 'interpretation', text: 'Humanitarian consequence cannot be inferred from magnitude alone; depth, exposure, building stock and reporting lag matter.' },
      { kind: 'question', text: 'What independent evidence would show whether infrastructure, shelter or lifeline services are deteriorating?' }
    ], sources: [{ label: 'USGS significant earthquakes', url: 'https://earthquake.usgs.gov/' }, { label: 'ReliefWeb API', url: 'https://reliefweb.int/' }, { label: 'GDELT', url: 'https://www.gdeltproject.org/' }] });
  }
  const evt = eonet?.events?.[0];
  if (evt) out.push({ id: 'event-attention-gap', title: 'Which natural events are being missed?', dek: 'NASA event observations are compared with broad news attention to surface stories that may be under-covered.', status: 'uncertain', location: { lat: evt.geometry?.at(-1)?.coordinates?.[1] ?? 0, lon: evt.geometry?.at(-1)?.coordinates?.[0] ?? 0, label: evt.title }, updatedAt: evt.geometry?.at(-1)?.date ?? now(), confidence: 48, metrics: [
    { label: 'Open events', value: String(eonet?.events?.length ?? 0) }, { label: 'Attention proxy', value: String(news?.articles?.length ?? 0), delta: 'GDELT sample' }, { label: 'Evidence quality', value: 'Mixed', delta: 'source-dependent' }
  ], evidence: [
    { kind: 'observed', text: `NASA EONET is tracking ${evt.title} as an open natural event.` },
    { kind: 'interpretation', text: 'Low media attention does not imply low consequence; it creates a research question worth investigating.' },
    { kind: 'question', text: 'Can satellite imagery, weather observations or humanitarian reports corroborate change on the ground?' }
  ], sources: [{ label: 'NASA EONET', url: 'https://eonet.gsfc.nasa.gov/' }, { label: 'GDELT', url: 'https://www.gdeltproject.org/' }] });
  return out;
}
