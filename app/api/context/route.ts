import { NextResponse } from 'next/server';

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

function answer(topic: string, place: string, facts: Fact[]) {
  return NextResponse.json({ lens: { topic, place, facts, retrievedAt: new Date().toISOString() } });
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


  if (t.includes('alert timing') || t.includes('local impact evidence') || (t.includes('satellite context') && entityId)) {
    const alerts = await json<any>('https://api.weather.gov/alerts/active?status=actual', { headers: { 'User-Agent': 'Elsewhere/0.1 (https://elsewhere-discover-nine.vercel.app)' } });
    const feature = (alerts?.features ?? []).find((entry: any) => entry.properties?.id === entityId || entry.id === entityId || entry.properties?.identifier === entityId) ?? (alerts?.features ?? [])[0];
    const props = feature?.properties;
    if (!props) return answer(topic, label, [
      { label: 'Alert evidence', value: 'The active-alert feed is unavailable or no matching alert is active now.', kind: 'question' },
      { label: 'Insight', value: 'A missing or expired alert cannot be treated as current evidence.', kind: 'interpretation' }
    ]);
    const expired = props.expires ? new Date(props.expires).getTime() < Date.now() : false;
    return answer(topic, props.areaDesc ?? label, [
      { label: 'Alert', value: props.event ?? 'Weather alert', kind: 'verified' },
      { label: 'Issued / effective', value: props.sent ? new Date(props.sent).toLocaleString() : 'Unavailable', kind: 'verified' },
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
  if (t.includes('aurora') || (t.includes('cloud') && label.toLowerCase().includes('aurora'))) insight = current ? `Cloud cover is the immediate visibility constraint: ${Math.round(current.cloud_cover)}% coverage means aurora or sky observation is ${current.cloud_cover > 70 ? 'unlikely without a break in clouds' : current.cloud_cover > 30 ? 'possible only through gaps' : 'more favorable, darkness permitting'}.` : insight;
  if (t.includes('wind') || t.includes('fire')) insight = current ? `Surface wind is a real measured variable here (${Math.round(current.wind_speed_10m)} km/h), but Elsewhere does not infer fire spread without fuel, humidity and authoritative incident data.` : insight;
  if (t.includes('tsunami')) insight = 'A tsunami cannot be inferred from an earthquake alone. The next evidence needed is an official tsunami bulletin, sea-level gauge anomaly or verified coastal observation.';
  if (t.includes('camera')) insight = 'No direct camera feed is assumed. A useful next step is finding an authorized local camera or official stream, then comparing it with the measured conditions shown here.';
  if (t.includes('weather')) insight = current ? `Weather here is being used as local context only: wind ${Math.round(current.wind_speed_10m)} km/h and precipitation ${current.precipitation ?? 0} mm do not by themselves confirm operational impact.` : insight;

  facts.push({ label: 'Insight', value: insight, kind: 'interpretation' });
  facts.push({ label: 'Next evidence', value: 'Independent local observation', kind: 'question' });
  return answer(topic, placeName || label, facts);
}
