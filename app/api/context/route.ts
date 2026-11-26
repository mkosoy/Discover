import { NextResponse } from 'next/server';
import { cameraCoverage, cameraEmbed, nearestPublicCameras } from '@/lib/cameras';

type Fact = { label: string; value: string; kind: 'observed' | 'verified' | 'interpretation' | 'prediction' | 'question' };

async function json<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, ...init, next: { revalidate: 120 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}


async function head(url: string): Promise<Headers | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow', next: { revalidate: 60 } });
    clearTimeout(timer);
    return res.ok ? res.headers : null;
  } catch { return null; }
}

function ageMinutes(input?: string | null) {
  if (!input) return null;
  const ms = Date.now() - new Date(input).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null;
}


async function text(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } });
    clearTimeout(timer);
    return res.ok ? await res.text() : null;
  } catch { return null; }
}
function xmlValue(block: string, tag: string) {
  const inner = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim();
  if (inner) return inner;
  return block.match(new RegExp(`<${tag}[^>]*value="([^"]+)"[^>]*/>`))?.[1]?.trim() ?? '';
}
function degreesApart(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180, x = (bLat - aLat) * rad, y = (bLon - aLon) * rad;
  const h = Math.sin(x / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(y / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) / rad;
}

function answer(topic: string, place: string, facts: Fact[], extra: Record<string, unknown> = {}) {
  return NextResponse.json({ lens: { topic, place, facts, retrievedAt: new Date().toISOString(), ...extra } });
}

function xrayClass(flux?: number) {
  if (!flux || !Number.isFinite(flux)) return 'Unavailable';
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic') ?? 'context';
  const label = url.searchParams.get('label') ?? 'this place';
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const t = topic.toLowerCase();
  const entityId = url.searchParams.get('entityId');
  const subject = (url.searchParams.get('subject') ?? label).toLowerCase();
  const occurredAt = url.searchParams.get('occurredAt');

  if (t.includes('solar wind')) {
    const [plasma, mag, xrays] = await Promise.all([
      json<any[]>('https://services.swpc.noaa.gov/json/ace/swepam/ace_swepam_1h.json'),
      json<any[]>('https://services.swpc.noaa.gov/json/ace/mag/ace_mag_1h.json'),
      json<any[]>('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json')
    ]);
    const p = plasma?.find(row => Number.isFinite(row?.speed));
    const m = mag?.find(row => Number.isFinite(row?.gsm_bz) || Number.isFinite(row?.gse_bz));
    const x = xrays?.at(-1);
    const bz = m?.gsm_bz ?? m?.gse_bz;
    return answer(topic, 'Sun–Earth L1 / near-Earth space', [
      { label: 'Solar wind speed', value: p ? `${Math.round(p.speed)} km/s` : 'Unavailable', kind: 'observed' },
      { label: 'Proton density', value: p?.dens != null ? `${p.dens.toFixed(1)} particles/cm³` : 'Unavailable', kind: 'observed' },
      { label: 'Magnetic Bz', value: bz != null ? `${bz.toFixed(1)} nT` : 'Unavailable', kind: 'observed' },
      { label: 'GOES X-ray class', value: xrayClass(x?.flux), kind: 'observed' },
      { label: 'Insight', value: bz == null ? 'Solar-wind measurements are unavailable, so geomagnetic coupling cannot be inferred.' : bz < -3 ? 'A southward magnetic field can couple more strongly with Earth’s magnetosphere, increasing aurora potential; it still does not guarantee visibility at any one place.' : 'The current magnetic orientation is not strongly southward, so this sample alone does not indicate enhanced geomagnetic coupling.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Kp response and local cloud/darkness', kind: 'question' }
    ]);
  }

  if (t.includes('volcano weather') || t.includes('ash and air quality') || t.includes('seismic context')) {
    const volcanoLat = Number.isFinite(lat) ? lat : 37.73;
    const volcanoLon = Number.isFinite(lon) ? lon : 15.0;
    const [weather, air, quakes] = await Promise.all([
      json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${volcanoLat}&longitude=${volcanoLon}&current=temperature_2m,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day&timezone=auto`),
      json<any>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${volcanoLat}&longitude=${volcanoLon}&current=pm10,pm2_5,dust,aerosol_optical_depth&timezone=auto`),
      json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')
    ]);
    const current = weather?.current;
    const airNow = air?.current;
    const nearbyQuakes = (quakes?.features ?? [])
      .map((event: any) => ({ event, distance: degreesApart(volcanoLat, volcanoLon, event.geometry?.coordinates?.[1] ?? 999, event.geometry?.coordinates?.[0] ?? 999) * 111.195 }))
      .filter((row: any) => row.distance <= 300)
      .sort((a: any, b: any) => a.distance - b.distance);
    const nearest = nearbyQuakes[0];
    const transportDirection = current?.wind_direction_10m != null ? (Number(current.wind_direction_10m) + 180) % 360 : null;
    return answer(topic, label, [
      { label: 'Wind at volcano', value: current ? `${Math.round(current.wind_speed_10m)} km/h, gusts ${Math.round(current.wind_gusts_10m ?? 0)} km/h` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Potential ash transport', value: transportDirection != null ? `toward about ${Math.round(transportDirection)}° if ash were present` : 'Unavailable', kind: transportDirection != null ? 'interpretation' : 'question' },
      { label: 'PM10 / dust model', value: airNow ? `${Math.round(airNow.pm10 ?? 0)} μg/m³ PM10 · ${Math.round(airNow.dust ?? 0)} μg/m³ dust` : 'Unavailable', kind: airNow ? 'interpretation' : 'question' },
      { label: 'Aerosol optical depth', value: airNow?.aerosol_optical_depth != null ? airNow.aerosol_optical_depth.toFixed(2) : 'Unavailable', kind: airNow ? 'interpretation' : 'question' },
      { label: 'Earthquakes within 300 km / 24h', value: String(nearbyQuakes.length), kind: 'observed' },
      nearest ? { label: 'Nearest seismic event', value: `M${Number(nearest.event.properties?.mag ?? 0).toFixed(1)} · ${Math.round(nearest.distance)} km away`, kind: 'observed' } : null,
      { label: 'Insight', value: t.includes('seismic') ? 'Regional earthquake counts provide geological context, but they do not establish volcanic unrest or eruption likelihood without specialist volcano-observatory evidence.' : 'Wind and aerosol models show where material could move if ash were present; they do not prove ash emissions. The live camera and official observatory bulletins remain separate evidence.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'INGV/Civil Protection volcano bulletin plus visible ash or seismic-instrument corroboration', kind: 'question' }
    ].filter(Boolean) as Fact[]);
  }

  const launchTopic = t.includes('launch') || t.includes('mission trajectory') || t.includes('pad camera') || (t.includes('weather constraint') && Boolean(entityId));
  if (launchTopic) {
    const launch = entityId
      ? await json<any>(`https://ll.thespacedevs.com/2.3.0/launches/${encodeURIComponent(entityId)}/?mode=detailed`)
      : (await json<any>('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=1&mode=detailed'))?.results?.[0];
    if (!launch) return answer(topic, 'Launch schedule unavailable', [
      { label: 'Launch evidence', value: 'The public launch schedule was unavailable at retrieval time.', kind: 'question' },
      { label: 'Insight', value: 'No launch-specific inference is made without the current published schedule.', kind: 'interpretation' }
    ]);
    const padLat = Number(launch.pad?.latitude);
    const padLon = Number(launch.pad?.longitude);
    const padWeather = Number.isFinite(padLat) && Number.isFinite(padLon) ? await json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${padLat}&longitude=${padLon}&current=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_gusts_10m&timezone=auto`) : null;
    const current = padWeather?.current;
    const padName = launch.pad?.location?.name ?? launch.pad?.name ?? 'launch complex';
    return answer(topic, padName, [
      { label: 'Next mission', value: launch.name ?? 'Unnamed mission', kind: 'verified' },
      { label: 'Published window', value: launch.net ? new Date(launch.net).toLocaleString() : 'TBD', kind: 'verified' },
      { label: 'Pad wind', value: current ? `${Math.round(current.wind_speed_10m)} km/h, gusts ${Math.round(current.wind_gusts_10m ?? 0)} km/h` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Pad precipitation', value: current ? `${current.precipitation ?? 0} mm` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Mission type', value: launch.mission?.type ?? 'Unknown', kind: 'verified' },
      { label: 'Insight', value: current ? `These are current weather conditions at ${padName}, not the mission operator’s Go/No-Go criteria. Strong wind, lightning or precipitation can constrain launches, but only the operator can confirm status.` : 'Pad weather is unavailable, so the schedule cannot be qualified locally.', kind: 'interpretation' },
      { label: 'Next evidence', value: launch.webcast_live ? 'Operator webcast marked live by Launch Library' : 'Operator status/webcast confirmation', kind: 'question' }
    ]);
  }

  if (t.includes('aftershock')) {
    const fallbackStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const start = occurredAt && !Number.isNaN(new Date(occurredAt).getTime()) ? new Date(occurredAt).toISOString() : fallbackStart;
    const bbox = Number.isFinite(lat) && Number.isFinite(lon) ? `&minlatitude=${lat - 4}&maxlatitude=${lat + 4}&minlongitude=${lon - 4}&maxlongitude=${lon + 4}` : '';
    const aftershocks = bbox ? await json<any>(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(start)}&minmagnitude=2.5&orderby=time${bbox}`) : null;
    const events = (aftershocks?.features ?? []).filter((event: any) => event.id !== entityId && (!occurredAt || new Date(event.properties?.time ?? 0).getTime() >= new Date(occurredAt).getTime()));
    const largest = events.reduce((a: any, b: any) => (b.properties?.mag ?? 0) > (a?.properties?.mag ?? 0) ? b : a, events[0]);
    return answer(topic, label, [
      { label: 'Subsequent nearby M2.5+ earthquakes', value: events.length ? String(events.length) : 'None since selected event', kind: 'observed' },
      { label: 'Largest in sequence', value: largest?.properties?.mag ? `M${largest.properties.mag.toFixed(1)}` : '—', kind: 'observed' },
      { label: 'Most recent', value: events[0]?.properties?.time ? new Date(events[0].properties.time).toLocaleString() : '—', kind: 'observed' },
      { label: 'Insight', value: events.length ? 'A clustered sequence can reflect aftershocks, but earthquake catalogs cannot reliably predict the timing or size of the next event.' : 'No subsequent nearby M2.5+ events appear in the catalog sample; absence means no recorded events above that threshold after the selected earthquake, not zero seismic risk.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Official regional seismic-network review', kind: 'question' }
    ]);
  }

  if (t.includes('pass') || t.includes('orbital')) {
    const iss = await json<any>('https://api.wheretheiss.at/v1/satellites/25544');
    return answer(topic, 'International Space Station', [
      { label: 'Current position', value: iss ? `${Number(iss.latitude).toFixed(1)}°, ${Number(iss.longitude).toFixed(1)}°` : 'Unavailable', kind: iss ? 'observed' : 'question' },
      { label: 'Velocity', value: iss ? `${Math.round(iss.velocity).toLocaleString()} km/h` : 'Unavailable', kind: iss ? 'observed' : 'question' },
      { label: 'Altitude', value: iss ? `${Math.round(iss.altitude)} km` : 'Unavailable', kind: iss ? 'observed' : 'question' },
      { label: 'Insight', value: 'A visible pass depends on where the observer is, local darkness, whether the station is sunlit and the horizon geometry. Elsewhere should request a viewing location before promising visibility.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Observer location plus illumination geometry', kind: 'question' }
    ]);
  }



  if (t.includes('satellite context')) {
    const imageUrl = 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/ne/GEOCOLOR/latest.jpg';
    const [imageHead, alerts, weather] = await Promise.all([
      head(imageUrl),
      json<any>('https://api.weather.gov/alerts/active?status=actual', { headers: { 'User-Agent': 'Elsewhere/0.1 (https://elsewhere-discover-nine.vercel.app)' } }),
      Number.isFinite(lat) && Number.isFinite(lon) ? json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover,precipitation,is_day&timezone=auto`) : null
    ]);
    const feature = entityId ? (alerts?.features ?? []).find((entry: any) => entry.properties?.id === entityId || entry.id === entityId || entry.properties?.identifier === entityId) : null;
    const age = ageMinutes(imageHead?.get('last-modified'));
    const current = weather?.current;
    return answer(topic, feature?.properties?.areaDesc ?? 'GOES-East Northeast sector', [
      { label: 'Satellite image freshness', value: age == null ? 'Unavailable' : age < 2 ? 'Under 2m old' : `${age}m old`, kind: age == null ? 'question' : 'observed' },
      { label: 'Alert context', value: feature?.properties?.event ?? 'No matching active NWS alert', kind: feature ? 'verified' : 'question' },
      { label: 'Local cloud cover', value: current ? `${Math.round(current.cloud_cover)}%` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Local precipitation', value: current ? `${current.precipitation ?? 0} mm` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Insight', value: 'The satellite image can corroborate the broader cloud system and its evolution, but it cannot verify street-level flooding, wind damage or casualties without ground evidence.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Radar sequence, local storm reports or emergency-management observations', kind: 'question' }
    ]);
  }

  if (t.includes('alert timing') || t.includes('local impact evidence')) {
    const alerts = await json<any>('https://api.weather.gov/alerts/active?status=actual', { headers: { 'User-Agent': 'Elsewhere/0.1 (https://elsewhere-discover-nine.vercel.app)' } });
    const feature = (alerts?.features ?? []).find((entry: any) => entry.properties?.id === entityId || entry.id === entityId || entry.properties?.identifier === entityId);
    const props = feature?.properties;
    if (!props) return answer(topic, label, [
      { label: 'Alert evidence', value: 'The active-alert feed is unavailable or no matching alert is active now.', kind: 'question' },
      { label: 'Insight', value: 'A missing or expired alert cannot be treated as current evidence.', kind: 'interpretation' }
    ]);
    const expired = props.expires ? new Date(props.expires).getTime() < Date.now() : false;
    return answer(topic, props.areaDesc ?? label, [
      { label: 'Alert', value: props.event ?? 'Weather alert', kind: 'verified' },
      { label: 'Issued', value: props.sent ? new Date(props.sent).toLocaleString() : 'Unavailable', kind: 'verified' },
      { label: 'Hazard starts', value: props.onset ? new Date(props.onset).toLocaleString() : props.effective ? new Date(props.effective).toLocaleString() : 'Unavailable', kind: 'verified' },
      { label: 'Hazard ends', value: props.ends ? new Date(props.ends).toLocaleString() : 'Not specified', kind: props.ends ? 'verified' : 'question' },
      { label: 'Expires', value: props.expires ? new Date(props.expires).toLocaleString() : 'Unavailable', kind: 'verified' },
      { label: 'Severity / urgency', value: `${props.severity ?? 'Unknown'} / ${props.urgency ?? 'Unknown'}`, kind: 'verified' },
      { label: 'Current status', value: expired ? 'Expired in current feed' : 'Listed as active by NWS', kind: 'verified' },
      { label: 'Insight', value: t.includes('impact') ? 'An NWS alert is authoritative forecast or warning evidence, but it is not by itself confirmation of damage, casualties or infrastructure failure on the ground.' : t.includes('satellite') ? 'Satellite imagery can show the broader cloud system evolving, but imagery alone does not verify impacts at street or community level.' : 'The useful timing comparison is onset versus expiration: it tells users whether this is emerging, ongoing or expected to end soon, not whether impacts have been observed.', kind: 'interpretation' },
      { label: 'Next evidence', value: t.includes('impact') ? 'Local storm reports, emergency-management statements or verified imagery' : 'NWS local storm reports plus current radar/satellite evolution', kind: 'question' }
    ]);
  }

  if (t.includes('cloud motion') || t.includes('storm context') || t.includes('solar illumination') || t.includes('satellite context')) {
    const imageUrl = 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/ne/GEOCOLOR/latest.jpg';
    const [imageHead, weather] = await Promise.all([
      head(imageUrl),
      Number.isFinite(lat) && Number.isFinite(lon) ? json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover,precipitation,wind_speed_10m,is_day&timezone=auto`) : null
    ]);
    const age = ageMinutes(imageHead?.get('last-modified'));
    const current = weather?.current;
    const insight = t.includes('cloud motion')
      ? 'One latest-frame image cannot measure motion by itself. It is evidence of current cloud structure; actual motion requires comparing a time sequence or a dedicated satellite animation product.'
      : t.includes('storm context')
        ? 'The image gives regional atmospheric context, but storm severity and local impacts require radar, warnings, ground reports or emergency-management evidence.'
        : 'Solar illumination helps explain what the imager can see: visible geocolor detail is strongest in daylight, while nighttime interpretation depends more on city lights and infrared-derived products.';
    return answer(topic, 'GOES-East Northeast sector', [
      { label: 'Image freshness', value: age == null ? 'Unavailable' : age < 2 ? 'Under 2m old' : `${age}m old`, kind: age == null ? 'question' : 'observed' },
      { label: 'Sector', value: 'Northeast United States / western Atlantic', kind: 'verified' },
      { label: 'Local cloud cover', value: current ? `${Math.round(current.cloud_cover)}%` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Local daylight', value: current ? (current.is_day ? 'Daylight' : 'Night') : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Local precipitation', value: current ? `${current.precipitation ?? 0} mm` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Insight', value: insight, kind: 'interpretation' },
      { label: 'Next evidence', value: 'A time sequence, radar product or verified local observation', kind: 'question' }
    ]);
  }

  if (t.includes('night light')) {
    const weather = Number.isFinite(lat) && Number.isFinite(lon) ? await json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover,is_day&timezone=auto`) : null;
    return answer(topic, label, [
      { label: 'Live night-light measurement', value: 'Unavailable in keyless public feeds', kind: 'question' },
      { label: 'Local darkness', value: weather?.current?.is_day === 0 ? 'Night' : weather?.current?.is_day === 1 ? 'Day' : 'Unknown', kind: weather?.current ? 'observed' : 'question' },
      { label: 'Cloud cover', value: weather?.current ? `${Math.round(weather.current.cloud_cover)}%` : 'Unavailable', kind: weather?.current ? 'observed' : 'question' },
      { label: 'Insight', value: 'NASA/VIIRS night-light imagery is a useful baseline for cities and infrastructure, but it is not a live activity feed. Elsewhere does not turn static radiance composites into claims about what is happening right now.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Current local imagery or verified power/grid observations', kind: 'question' }
    ]);
  }


  if (t.includes('exposure model') || t.includes('relief data')) {
    const xml = await text('https://www.gdacs.org/xml/rss.xml');
    const events = xml ? [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => {
      const block = match[1];
      return { title: xmlValue(block, 'title'), type: xmlValue(block, 'gdacs:eventtype'), alert: xmlValue(block, 'gdacs:alertlevel') || 'Green', severity: xmlValue(block, 'gdacs:severity'), population: xmlValue(block, 'gdacs:population'), vulnerability: xmlValue(block, 'gdacs:vulnerability'), country: xmlValue(block, 'gdacs:country'), modified: xmlValue(block, 'gdacs:datemodified') || xmlValue(block, 'pubDate'), lat: Number(xmlValue(block, 'geo:lat')), lon: Number(xmlValue(block, 'geo:long')), current: xmlValue(block, 'gdacs:iscurrent') };
    }).filter(event => Number.isFinite(event.lat) && Number.isFinite(event.lon) && event.current !== 'false') : [];
    const event = events.sort((a, b) => degreesApart(lat, lon, a.lat, a.lon) - degreesApart(lat, lon, b.lat, b.lon))[0];
    if (!event) return answer(topic, label, [
      { label: 'GDACS model', value: 'Unavailable', kind: 'question' },
      { label: 'Insight', value: 'No modeled exposure claim is made without the current GDACS bulletin.', kind: 'interpretation' }
    ]);
    return answer(topic, event.country || label, [
      { label: 'Modeled event', value: event.title || 'GDACS event', kind: 'verified' },
      { label: 'Alert level', value: event.alert, kind: 'verified' },
      { label: 'Modeled severity', value: event.severity || 'Unavailable', kind: 'verified' },
      { label: 'Exposed population', value: event.population || 'Unavailable', kind: 'verified' },
      { label: 'Vulnerability context', value: event.vulnerability || 'Unavailable', kind: 'verified' },
      { label: 'Insight', value: t.includes('relief') ? 'GDACS models potential humanitarian impact; it is not a relief allocation or needs assessment. Actual response requires OCHA, agency and local operational evidence.' : 'The exposure model estimates who may be affected using event magnitude, population and vulnerability. It is not direct confirmation of casualties, damage or current conditions on the ground.', kind: 'interpretation' },
      { label: 'Next evidence', value: t.includes('relief') ? 'OCHA relief updates, agency appeals and local needs assessments' : 'Verified local reports or official damage assessments', kind: 'question' }
    ]);
  }

  if (t.includes('event timeline') && entityId) {
    const event = await json<any>(`https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(entityId)}`);
    const geometry = event?.geometry ?? [];
    const first = geometry[0], latest = geometry.at(-1);
    const firstDate = first?.date ? new Date(first.date).getTime() : NaN;
    const latestDate = latest?.date ? new Date(latest.date).getTime() : NaN;
    const span = Number.isFinite(firstDate) && Number.isFinite(latestDate) ? Math.max(0, Math.round((latestDate - firstDate) / 86400000)) : null;
    const hasTrack = geometry.length >= 2;
    const movement = hasTrack && first && latest ? degreesApart(first.coordinates[1], first.coordinates[0], latest.coordinates[1], latest.coordinates[0]) : null;
    return answer(topic, event?.title ?? label, [
      { label: 'Tracked positions', value: geometry.length ? String(geometry.length) : 'Unavailable', kind: geometry.length ? 'observed' : 'question' },
      { label: 'First / latest geometry', value: first?.date && latest?.date ? `${new Date(first.date).toLocaleDateString()} → ${new Date(latest.date).toLocaleDateString()}` : 'Unavailable', kind: first && latest ? 'observed' : 'question' },
      { label: 'Tracked span', value: span == null ? 'Unavailable' : span === 0 ? 'Same-day sample' : `${span} days`, kind: span == null ? 'question' : 'observed' },
      { label: 'Position shift', value: !hasTrack ? 'Not enough positions to infer movement' : movement == null ? 'Unavailable' : `${movement.toFixed(1)}° across track`, kind: !hasTrack || movement == null ? 'question' : 'observed' },
      { label: 'Insight', value: 'The event timeline shows persistence and movement in the public track. It does not measure intensity, damage or whether conditions are improving without additional evidence.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Current satellite imagery, weather and verified local reporting', kind: 'question' }
    ]);
  }

  if (t.includes('storm surge') || t.includes('coastal currents') || t.includes('coastal cameras')) {
    const marine = Number.isFinite(lat) && Number.isFinite(lon) ? await json<any>(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_period,swell_wave_height,swell_wave_period,ocean_current_velocity,ocean_current_direction&hourly=wave_height&forecast_days=2&timezone=auto`) : null;
    const current = marine?.current;
    const times = marine?.hourly?.time ?? [];
    const start = Date.now(), end = start + 24 * 60 * 60 * 1000;
    const waves = (marine?.hourly?.wave_height ?? [])
      .map((value: any, index: number) => ({ value, time: new Date(times[index] ?? 0).getTime() }))
      .filter((row: any) => Number.isFinite(row.value) && row.time >= start && row.time <= end)
      .map((row: any) => row.value);
    const maxWave = waves.length ? Math.max(...waves) : null;
    return answer(topic, label, [
      { label: 'Current wave height', value: current ? `${current.wave_height?.toFixed?.(1) ?? current.wave_height} m` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Ocean current', value: current?.ocean_current_velocity != null ? `${current.ocean_current_velocity.toFixed(1)} km/h toward ${Math.round(current.ocean_current_direction ?? 0)}°` : 'Unavailable', kind: current?.ocean_current_velocity != null ? 'observed' : 'question' },
      { label: 'Swell height / period', value: current ? `${current.swell_wave_height?.toFixed?.(1) ?? current.swell_wave_height} m / ${Math.round(current.swell_wave_period ?? 0)}s` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Next 24h modeled max', value: maxWave != null ? `${maxWave.toFixed(1)} m` : 'Unavailable', kind: maxWave != null ? 'prediction' : 'question' },
      { label: 'Insight', value: t.includes('camera') ? 'No direct coastal camera is assumed. Wave and swell measurements can guide what to look for, but only authorized imagery or local observation can confirm what the coast looks like.' : 'Wave, swell and modeled current conditions describe ocean energy and movement, but they are not a storm-surge measurement. Surge requires sea-level, pressure, wind and coastal geometry evidence.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Tide gauge, pressure field, authorized coastal camera or local observation', kind: 'question' }
    ]);
  }

  if (t.includes('air quality')) {
    const air = Number.isFinite(lat) && Number.isFinite(lon) ? await json<any>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,ozone,aerosol_optical_depth&timezone=auto`) : null;
    const current = air?.current;
    return answer(topic, label, [
      { label: 'PM2.5', value: current ? `${Math.round(current.pm2_5)} µg/m³` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'PM10', value: current ? `${Math.round(current.pm10)} µg/m³` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Ozone', value: current ? `${Math.round(current.ozone)} µg/m³` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Aerosol optical depth', value: current?.aerosol_optical_depth != null ? current.aerosol_optical_depth.toFixed(2) : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Insight', value: 'Air quality is an independent city-scale layer: it can corroborate smoke, pollution or atmospheric stillness, but it does not explain causes by itself.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Wind, fire, traffic and satellite aerosol evidence', kind: 'question' }
    ]);
  }

  if (t.includes('camera') || t.includes('live look')) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return answer(topic, label, [
      { label: 'Camera evidence', value: 'A location is required to rank public cameras.', kind: 'question' }
    ]);
    const cameras = nearestPublicCameras(lat, lon, 3);
    const coverage = cameraCoverage();
    const best = cameras[0];
    const weather = await json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover,is_day&timezone=auto`);
    const current = weather?.current;
    return answer(topic, best ? `${best.place} · nearest curated public look-in` : label, [
      { label: 'Best public look-in', value: best ? `${best.title} · ${Math.round(best.distance)} km away` : 'No curated public camera available', kind: best ? 'verified' : 'question' },
      { label: 'Additional look-ins', value: cameras.length > 1 ? cameras.slice(1).map(camera => `${camera.title} (${Math.round(camera.distance)} km)`).join(' · ') : 'None in the curated registry', kind: cameras.length > 1 ? 'verified' : 'question' },
      { label: 'Local sky cover', value: current ? `${Math.round(current.cloud_cover)}% · ${current.is_day ? 'daylight' : 'dark now'}` : 'Unavailable', kind: current ? 'observed' : 'question' },
      { label: 'Camera coverage', value: `${coverage.total} public look-ins across ${coverage.countries} countries`, kind: 'observed' },
      { label: 'Position precision', value: best?.approximate ? 'Country-level estimate; confirm in source' : 'Camera-specific location', kind: best?.approximate ? 'question' : 'verified' },
      { label: 'Insight', value: best && best.distance < 250 ? 'This is close enough to provide meaningful local visual context, but the camera still shows only its own field of view and cannot verify the event by itself.' : best ? 'This is the nearest curated public camera, but it is not close enough to treat as direct local evidence; use it as regional atmosphere and compare distance carefully.' : 'No camera inference is made.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'A closer authorized local stream, official incident imagery or verified ground observation', kind: 'question' }
    ], { videos: cameras.map(camera => ({ title: camera.title, place: camera.place, distance: Math.round(camera.distance), src: cameraEmbed(camera), youtubeId: camera.youtubeId, quality: camera.quality, approximate: camera.approximate, confidence: camera.confidence, image: camera.stillImage, sourceUrl: camera.sourceUrl })) });
  }

  if (t.includes('historical comparison')) {
    const gridLike = subject.includes('grid') || subject.includes('electricity') || subject.includes('carbon') || label.toLowerCase().includes('britain') || label.toLowerCase().includes('uk');
    if (!gridLike && Number.isFinite(lat) && Number.isFinite(lon)) {
      const lastYearDate = new Date();
      lastYearDate.setUTCFullYear(lastYearDate.getUTCFullYear() - 1);
      const date = lastYearDate.toISOString().slice(0, 10);
      const [currentWeather, archive] = await Promise.all([
        json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,cloud_cover,wind_speed_10m&timezone=auto`),
        json<any>(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,precipitation,cloud_cover,wind_speed_10m&timezone=auto`)
      ]);
      const current = currentWeather?.current;
      const hourly = archive?.hourly;
      const targetHour = current?.time ? `${date}T${String(current.time).slice(11, 13)}:00` : '';
      let index = hourly?.time?.indexOf(targetHour) ?? -1;
      if (index < 0 && hourly?.time?.length && current?.time) {
        const hour = Number(String(current.time).slice(11, 13));
        index = Math.max(0, Math.min(hourly.time.length - 1, hour));
      }
      const historic = hourly && index >= 0 ? {
        temperature: hourly.temperature_2m?.[index], precipitation: hourly.precipitation?.[index], cloud: hourly.cloud_cover?.[index], wind: hourly.wind_speed_10m?.[index]
      } : null;
      const tempDelta = current && historic?.temperature != null ? current.temperature_2m - historic.temperature : null;
      const windDelta = current && historic?.wind != null ? current.wind_speed_10m - historic.wind : null;
      return answer(topic, label, [
        { label: 'Now', value: current ? `${Math.round(current.temperature_2m)}°C · ${Math.round(current.cloud_cover)}% cloud · ${Math.round(current.wind_speed_10m)} km/h wind` : 'Unavailable', kind: current ? 'observed' : 'question' },
        { label: 'Same date/hour last year', value: historic?.temperature != null ? `${Math.round(historic.temperature)}°C · ${Math.round(historic.cloud ?? 0)}% cloud · ${Math.round(historic.wind ?? 0)} km/h wind` : 'Unavailable', kind: historic?.temperature != null ? 'verified' : 'question' },
        { label: 'Temperature difference', value: tempDelta != null ? `${tempDelta >= 0 ? '+' : ''}${tempDelta.toFixed(1)}°C versus last year` : 'Unavailable', kind: tempDelta != null ? 'interpretation' : 'question' },
        { label: 'Wind difference', value: windDelta != null ? `${windDelta >= 0 ? '+' : ''}${windDelta.toFixed(1)} km/h versus last year` : 'Unavailable', kind: windDelta != null ? 'interpretation' : 'question' },
        { label: 'Insight', value: 'This is a concrete same-place, same-date comparison across one year. It is useful context for how unusual the moment feels, but a single prior year is not a climate normal and cannot explain cause by itself.', kind: 'interpretation' },
        { label: 'Next evidence', value: '30-year climate normals plus longer hourly/seasonal baselines', kind: 'question' }
      ]);
    }
    const intensity = await json<any>('https://api.carbonintensity.org.uk/intensity/date');
    const rows = (intensity?.data ?? []).map((row: any) => row?.intensity?.actual).filter((v: any) => Number.isFinite(v));
    const latest = rows.at(-1), average = rows.length ? rows.reduce((a: number, b: number) => a + b, 0) / rows.length : null;
    return answer(topic, label, [
      { label: 'Latest carbon intensity', value: latest != null ? `${Math.round(latest)} gCO₂/kWh` : 'Unavailable', kind: latest != null ? 'observed' : 'question' },
      { label: 'Today’s observed average', value: average != null ? `${Math.round(average)} gCO₂/kWh` : 'Unavailable', kind: average != null ? 'observed' : 'question' },
      { label: 'Day range', value: rows.length ? `${Math.round(Math.min(...rows))}–${Math.round(Math.max(...rows))} gCO₂/kWh` : 'Unavailable', kind: rows.length ? 'observed' : 'question' },
      { label: 'Insight', value: latest != null && average != null ? (rows.length < 4 ? 'Only a few observed intervals are available today, so the baseline is too thin for a meaningful cleaner/dirtier comparison.' : latest < average ? 'The grid is currently cleaner than today’s observed average, consistent with strong low-carbon generation, but not proof of cause.' : latest > average ? 'The grid is currently dirtier than today’s observed average; compare wind output and demand before inferring why.' : 'The latest observed interval matches today’s observed average.') : 'Historical grid comparison is unavailable right now.', kind: 'interpretation' },
      { label: 'Next evidence', value: 'Wind generation, demand and interconnectors for the same interval', kind: 'question' }
    ]);
  }

  const [weather, place] = await Promise.all([
    Number.isFinite(lat) && Number.isFinite(lon) ? json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,cloud_cover,weather_code,wind_speed_10m&timezone=auto`) : null,
    Number.isFinite(lat) && Number.isFinite(lon) ? json<any>(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`, { headers: { 'User-Agent': 'Elsewhere/0.1 (https://elsewhere-discover-nine.vercel.app)' } }) : null
  ]);
  const current = weather?.current;
  const facts: Fact[] = [];
  if (current) {
    facts.push({ label: 'Cloud cover', value: `${Math.round(current.cloud_cover)}%`, kind: 'observed' });
    facts.push({ label: 'Wind', value: `${Math.round(current.wind_speed_10m)} km/h`, kind: 'observed' });
    facts.push({ label: 'Feels like', value: `${Math.round(current.apparent_temperature)}°C`, kind: 'observed' });
  } else facts.push({ label: 'Weather', value: 'Unavailable', kind: 'question' });
  const address = place?.address ?? {};
  const placeName = place?.display_name || [address.city, address.town, address.village, address.municipality, address.county, address.state, address.country].filter(Boolean).join(', ');
  facts.push({ label: 'Place context', value: placeName || label, kind: placeName ? 'verified' : 'question' });

  let insight = 'This layer grounds the story in current local conditions rather than treating the original signal as self-explanatory.';
  if (t.includes('aurora') || (t.includes('cloud') && subject.includes('aurora'))) insight = current ? `Cloud cover is the immediate visibility constraint: ${Math.round(current.cloud_cover)}% coverage means aurora or sky observation is ${current.cloud_cover > 70 ? 'unlikely without a break in clouds' : current.cloud_cover > 30 ? 'possible only through gaps' : 'more favorable, darkness permitting'}.` : insight;
  if (t.includes('wind') || t.includes('fire')) insight = current ? `Surface wind is a real measured variable here (${Math.round(current.wind_speed_10m)} km/h), but Elsewhere does not infer fire spread without fuel, humidity and authoritative incident data.` : insight;
  if (t.includes('tsunami')) insight = 'A tsunami cannot be inferred from an earthquake alone. The next evidence needed is an official tsunami bulletin, sea-level gauge anomaly or verified coastal observation.';
  if (t.includes('camera')) insight = 'No direct camera feed is assumed. A useful next step is finding an authorized local camera or official stream, then comparing it with the measured conditions shown here.';
  if (t.includes('weather')) insight = current ? `Weather here is being used as local context only: wind ${Math.round(current.wind_speed_10m)} km/h and precipitation ${current.precipitation ?? 0} mm do not by themselves confirm operational impact.` : insight;

  facts.push({ label: 'Insight', value: insight, kind: 'interpretation' });
  facts.push({ label: 'Next evidence', value: 'Independent local observation', kind: 'question' });
  return answer(topic, placeName || label, facts);
}
