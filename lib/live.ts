import type { Discovery, Investigation } from './types';
import { ago, until } from './time';

const now = () => new Date().toISOString();
const src = (label: string, url: string) => ({ label, url, retrievedAt: now() });
async function json<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, ...init, next: { revalidate: 60 } });
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

async function text(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function xmlValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() ?? '';
}

function parseGoogleNews(xml: string | null) {
  if (!xml) return [];
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 50).map(match => {
    const block = match[1];
    const source = xmlValue(block, 'source');
    return { title: xmlValue(block, 'title'), url: xmlValue(block, 'link'), seendate: xmlValue(block, 'pubDate'), domain: source || 'Google News', sourcecountry: 'Unknown', language: 'RSS edition' };
  }).filter(article => article.title);
}

function newsTime(value: string | undefined) {
  if (!value) return NaN;
  const direct = new Date(value).getTime();
  if (Number.isFinite(direct)) return direct;
  const compact = value.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})?/);
  return compact ? Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]), Number(compact[4]), Number(compact[5]), Number(compact[6] ?? 0)) : NaN;
}

function parseGdacs(xml: string | null) {
  if (!xml) return null;
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => {
    const block = match[1];
    const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const alert = xmlValue(block, 'gdacs:alertlevel') || 'Green';
    const severityBlock = block.match(/<gdacs:severity[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/gdacs:severity>/);
    const severity = severityBlock?.[2]?.trim() || xmlValue(block, 'gdacs:severity');
    return {
      title: xmlValue(block, 'title'), link: decode(xmlValue(block, 'link')), published: xmlValue(block, 'gdacs:datemodified') || xmlValue(block, 'pubDate'),
      lat: Number(xmlValue(block, 'geo:lat')), lon: Number(xmlValue(block, 'geo:long')), eventType: xmlValue(block, 'gdacs:eventtype'), alert,
      alertScore: Number(xmlValue(block, 'gdacs:alertscore')) || ({ Red: 3, Orange: 2, Green: 1 } as Record<string, number>)[alert] || 0,
      severity, country: xmlValue(block, 'gdacs:country'), population: xmlValue(block, 'gdacs:population'), vulnerability: xmlValue(block, 'gdacs:vulnerability'), current: xmlValue(block, 'gdacs:iscurrent'),
      image: block.match(/<enclosure[^>]+url="([^"]+)"/)?.[1]
    };
  }).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon) && item.current !== 'false');
  const recentHazards = items.filter(item => item.eventType !== 'DR' && Date.now() - new Date(item.published).getTime() < 1000 * 60 * 60 * 72);
  return (recentHazards.length ? recentHazards : items).sort((a, b) => b.alertScore - a.alertScore || new Date(b.published).getTime() - new Date(a.published).getTime())[0] ?? null;
}

function xrayClass(flux?: number) {
  if (!flux || !Number.isFinite(flux)) return 'Unavailable';
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
}

function angularDistance(a: Discovery, b: Discovery) {
  const rad = Math.PI / 180;
  const x = Math.sin((90 - a.location.lat) * rad) * Math.cos((a.location.lon + 180) * rad);
  const y = Math.cos((90 - a.location.lat) * rad);
  const z = Math.sin((90 - a.location.lat) * rad) * Math.sin((a.location.lon + 180) * rad);
  const x2 = Math.sin((90 - b.location.lat) * rad) * Math.cos((b.location.lon + 180) * rad);
  const y2 = Math.cos((90 - b.location.lat) * rad);
  const z2 = Math.sin((90 - b.location.lat) * rad) * Math.sin((b.location.lon + 180) * rad);
  return Math.acos(Math.max(-1, Math.min(1, x * x2 + y * y2 + z * z2))) / rad;
}

function geometryCentroid(geometry: any): [number, number] | null {
  const points: number[][] = [];
  const walk = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') points.push(coords);
    else coords.forEach(walk);
  };
  walk(geometry?.coordinates);
  if (!points.length) return null;
  return [points.reduce((sum, point) => sum + point[1], 0) / points.length, points.reduce((sum, point) => sum + point[0], 0) / points.length];
}

function connectionReason(a: Discovery, b: Discovery): string | null {
  const pair = [a.id, b.id].join('|');
  if (pair.includes('solar-wind') && pair.includes('aurora-watch')) return 'Solar wind and magnetic orientation upstream can shape aurora conditions downstream.';
  if (pair.includes('solar-wind') && pair.includes('iss-over-earth')) return 'Both are part of the same near-Earth space environment.';
  if (pair.includes('launch') && pair.includes('solar-wind')) return 'Space weather is operational context for spacecraft and communications, not a launch decision by itself.';
  if (pair.includes('tokyo-air-corridor') && pair.includes('tokyo-waking')) return 'Aviation, weather and air quality are simultaneous layers over the same megacity.';
  if (pair.includes('nazare-swell') && pair.includes('storm')) return 'Ocean waves and storm systems can share atmospheric forcing.';
  const distance = angularDistance(a, b);
  if (pair.includes('nws-alert') && pair.includes('goes-atlantic-watch') && distance < 25) return 'The satellite image can supply atmospheric context for the alert area, but imagery alone does not verify impacts on the ground.';
  if (pair.includes('quake-') && pair.includes('gdacs-EQ') && distance < 2) return 'USGS observations and GDACS impact modeling are looking at the same seismic event; agreement strengthens location evidence, while damage remains unconfirmed.';
  if (pair.includes('eonet-') && pair.includes('gdacs-WF') && distance < 5) return 'NASA event tracking and GDACS humanitarian modeling both point to nearby wildfire activity; neither alone confirms local damage.';
  if (pair.includes('eonet-') && pair.includes('gdacs-FL') && distance < 5) return 'NASA event tracking and GDACS humanitarian modeling both point to nearby flood or storm conditions; compare them as corroborating signals, not proof of impact.';
  if (pair.includes('gdacs-FL') && pair.includes('nazare-swell') && distance < 22) return 'Both are water and weather signals around the eastern Atlantic; they can be compared as concurrent model evidence, but no shared cause is established.';
  if (pair.includes('gdacs') && pair.includes('uk-grid-wind-pulse') && distance < 22) return 'Severe weather can matter for energy demand and infrastructure resilience, but this connection is contextual rather than causal.';
  if ((a.template === 'geology' && b.template === 'ocean' || b.template === 'geology' && a.template === 'ocean') && distance < 25) return 'The earthquake is close enough to this coastline to make sea-level evidence worth checking, but no tsunami is established.';
  if (distance < 12) return `Nearby on the globe (${Math.round(distance)}° apart), worth comparing as simultaneous regional conditions.`;
  return null;
}

function connectDiscoveries(out: Discovery[]) {
  return out.map(discovery => ({
    ...discovery,
    connections: out
      .filter(other => other.id !== discovery.id)
      .map(other => ({ other, reason: connectionReason(discovery, other) }))
      .filter((link): link is { other: Discovery; reason: string } => Boolean(link.reason))
      .map(link => ({ id: link.other.id, title: link.other.title, reason: link.reason, strength: Math.round((link.other.score + discovery.score) / 2) }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3)
  }));
}

export async function getDiscoveries(): Promise<Discovery[]> {
  const retrieved = now();
  const [iss, quakes, eonet, kp, launches, tokyo, swepam, aceMag, xrays, marine, tokyoAir, flights, carbon, generation, gdacsXml, namib, goesHead, nwsAlerts] = await Promise.all([
    json<any>('https://api.wheretheiss.at/v1/satellites/25544'),
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'),
    json<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=10'),
    json<any[]>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
    json<any>('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=4&mode=detailed'),
    json<any>('https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto'),
    json<any[]>('https://services.swpc.noaa.gov/json/ace/swepam/ace_swepam_1h.json'),
    json<any[]>('https://services.swpc.noaa.gov/json/ace/mag/ace_mag_1h.json'),
    json<any[]>('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json'),
    json<any>('https://marine-api.open-meteo.com/v1/marine?latitude=39.6&longitude=-9.07&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period&timezone=auto'),
    json<any>('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=35.68&longitude=139.69&current=pm2_5,pm10,ozone,aerosol_optical_depth&timezone=auto'),
    json<any>('https://api.adsb.lol/v2/lat/35.68/lon/139.69/dist/100'),
    json<any>('https://api.carbonintensity.org.uk/intensity'),
    json<any>('https://api.carbonintensity.org.uk/generation'),
    text('https://www.gdacs.org/xml/rss.xml'),
    json<any>('https://api.open-meteo.com/v1/forecast?latitude=-23.65&longitude=15.95&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto'),
    head('https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/ne/GEOCOLOR/latest.jpg'),
    json<any>('https://api.weather.gov/alerts/active?status=actual&message_type=alert', { headers: { 'User-Agent': 'Elsewhere/0.1 (https://elsewhere-discover-nine.vercel.app)' } })
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

  const plasma = swepam?.find(row => Number.isFinite(row?.speed));
  const mag = aceMag?.find(row => Number.isFinite(row?.gsm_bz) || Number.isFinite(row?.gse_bz));
  const xray = xrays?.at(-1);
  if (plasma || mag || xray) {
    const speed = plasma?.speed ?? 0;
    const bz = mag?.gsm_bz ?? mag?.gse_bz;
    out.push({
      id: 'solar-wind-stream', template: 'atmosphere', title: 'The solar wind is pressing against near-Earth space', kicker: 'NOAA real-time space weather', visual: 'orbital', score: 86 + Math.max(0, Math.min(8, (speed - 400) / 50)), freshness: plasma?.time_tag ? ago(plasma.time_tag) : 'minutes ago',
      mediaImage: 'https://services.swpc.noaa.gov/images/animations/suvi/primary/195/latest.png', mediaAlt: 'Latest NOAA GOES solar ultraviolet image',
      location: { lat: 72, lon: -40, label: 'Sun–Earth L1 → polar magnetosphere' },
      summary: 'ACE measures solar-wind particles and magnetic fields upstream of Earth while GOES watches the Sun in X-rays. The map marker represents the downstream polar impact region, not the spacecraft position.',
      facts: [
        { label: 'Solar wind', value: plasma ? `${Math.round(plasma.speed)} km/s` : '—', kind: 'observed' },
        { label: 'Magnetic Bz', value: bz != null ? `${bz.toFixed(1)} nT` : '—', kind: 'observed' },
        { label: 'X-ray class', value: xrayClass(xray?.flux), kind: 'observed' },
        { label: 'Coupling', value: bz != null && bz < -3 ? 'Potentially enhanced' : 'Not established', kind: 'interpretation' }
      ],
      sources: [src('NOAA ACE SWEPAM', 'https://services.swpc.noaa.gov/json/ace/swepam/ace_swepam_1h.json'), src('NOAA ACE MAG', 'https://services.swpc.noaa.gov/json/ace/mag/ace_mag_1h.json'), src('NOAA GOES X-rays', 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json')],
      related: ['Solar wind speed', 'Aurora watch', 'Upcoming launches']
    });
  }

  const q = quakes?.features?.sort((a: any, b: any) => (b.properties?.mag ?? 0) - (a.properties?.mag ?? 0))[0];
  if (q) {
    const [lon, lat, depth] = q.geometry.coordinates;
    out.push({ id: `quake-${q.id}`, entityId: q.id, occurredAt: new Date(q.properties.time).toISOString(), template: 'geology', title: 'A significant earthquake just reshaped the seismic map', kicker: 'USGS live event', visual: 'seismic', score: 82 + Math.min(14, q.properties.mag * 2), freshness: ago(q.properties.time), location: { lat, lon, label: q.properties.place }, summary: `A magnitude ${q.properties.mag.toFixed(1)} earthquake was recorded near ${q.properties.place}. The shake is real observed data; broader impact is deliberately left as an open question until corroborated.`, facts: [
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
  if (goesHead) {
    const modified = goesHead.get('last-modified');
    out.push({
      id: 'goes-atlantic-watch', template: 'atmosphere', title: 'A weather satellite is watching the Atlantic seaboard evolve', kicker: 'NOAA near-real-time imagery', visual: 'aurora', score: 84,
      freshness: modified ? ago(modified) : 'updated within minutes', mediaImage: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/ne/GEOCOLOR/latest.jpg', mediaAlt: 'Latest NOAA GOES-East geocolor image of the northeast United States and western Atlantic',
      location: { lat: 40.3, lon: -70.2, label: 'Northeast US / western Atlantic' },
      summary: 'GOES-East geocolor imagery is updated by NOAA in near-real time. It shows clouds, snow, smoke and daylight patterns from orbit; interpretation still requires ground truth.',
      facts: [
        { label: 'Image age', value: modified ? ago(modified) : 'Minutes', kind: 'observed' },
        { label: 'Sensor', value: 'GOES-East ABI GeoColor', kind: 'verified' },
        { label: 'Coverage', value: 'Northeast US + Atlantic', kind: 'verified' },
        { label: 'Ground truth', value: 'Still required', kind: 'question' }
      ],
      sources: [src('NOAA STAR GOES imagery', 'https://www.star.nesdis.noaa.gov/GOES/')], related: ['Cloud motion', 'Storm context', 'Solar illumination']
    });
  }

  const rankedAlerts = (nwsAlerts?.features ?? [])
    .map((alert: any) => {
      const props = alert.properties ?? {};
      const centroid = geometryCentroid(alert.geometry);
      const severity = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 }[props.severity as 'Extreme' | 'Severe' | 'Moderate' | 'Minor'] ?? 0;
      const urgency = { Immediate: 2, Expected: 1 }[props.urgency as 'Immediate' | 'Expected'] ?? 0;
      const certainty = { Observed: 2, Likely: 1 }[props.certainty as 'Observed' | 'Likely'] ?? 0;
      return { alert, props, centroid, rank: severity * 10 + urgency * 3 + certainty };
    })
    .filter((row: any) => row.centroid && row.props.event)
    .sort((a: any, b: any) => b.rank - a.rank || new Date(b.props.sent ?? 0).getTime() - new Date(a.props.sent ?? 0).getTime());
  const activeAlert = rankedAlerts[0];
  if (activeAlert) {
    const [alertLat, alertLon] = activeAlert.centroid;
    const eventName = activeAlert.props.event as string;
    const isWater = /flood|surf|marine|storm surge|coastal/i.test(eventName);
    out.push({
      id: `nws-alert-${activeAlert.alert.id ?? activeAlert.props.identifier ?? eventName}`, entityId: activeAlert.props.identifier, occurredAt: activeAlert.props.sent,
      template: isWater ? 'ocean' : /fire|smoke/i.test(eventName) ? 'wildfire' : 'atmosphere',
      title: `${eventName} is active in the United States`, kicker: 'National Weather Service live alert', visual: isWater ? 'ocean' : 'aurora', score: 72 + activeAlert.rank,
      freshness: activeAlert.props.sent ? ago(activeAlert.props.sent) : 'active now',
      location: { lat: alertLat, lon: alertLon, label: activeAlert.props.areaDesc ?? 'NWS alert area' },
      summary: 'The National Weather Service is actively warning or advising this area. Elsewhere treats the alert itself as verified evidence, while local damage and casualties remain separate questions.',
      facts: [
        { label: 'Severity', value: activeAlert.props.severity ?? '—', kind: 'verified' },
        { label: 'Urgency', value: activeAlert.props.urgency ?? '—', kind: 'verified' },
        { label: 'Expires', value: activeAlert.props.expires ? until(activeAlert.props.expires) : 'See alert', kind: 'verified' },
        { label: 'Impact evidence', value: 'Not established', kind: 'question' }
      ],
      sources: [src('NWS active alerts', activeAlert.alert.id ?? 'https://api.weather.gov/alerts/active')], related: ['Alert timing', 'Satellite context', 'Local impact evidence']
    });
  }

  const gdacs = parseGdacs(gdacsXml);
  if (gdacs) {
    const typeName = { EQ: 'earthquake', TC: 'tropical cyclone', FL: 'flood', VO: 'volcanic activity', TS: 'tsunami', DR: 'drought', WF: 'wildfire' }[gdacs.eventType as 'EQ' | 'TC' | 'FL' | 'VO' | 'TS' | 'DR' | 'WF'] ?? 'natural disaster';
    const visual = gdacs.eventType === 'VO' || gdacs.eventType === 'EQ' ? 'seismic' : gdacs.eventType === 'DR' || gdacs.eventType === 'WF' ? 'fire' : 'aurora';
    const regionParts = (gdacs.country || '').split(',').map((part: string) => part.trim()).filter(Boolean);
    const region = regionParts.length > 2 ? `${regionParts.slice(0, 2).join(', ')} +${regionParts.length - 2} more` : regionParts.join(', ');
    out.push({
      id: `gdacs-${gdacs.eventType}-${gdacs.lat.toFixed(1)}-${gdacs.lon.toFixed(1)}`, template: gdacs.eventType === 'EQ' || gdacs.eventType === 'VO' ? 'geology' : gdacs.eventType === 'FL' ? 'ocean' : gdacs.eventType === 'WF' ? 'wildfire' : 'atmosphere',
      title: `${gdacs.alert} ${typeName} signal near ${region || 'an exposed region'}`, kicker: 'GDACS humanitarian disaster model', visual, score: 72 + gdacs.alertScore * 8,
      freshness: gdacs.published ? ago(gdacs.published) : 'current bulletin', mediaImage: gdacs.image, mediaAlt: `GDACS impact map for ${gdacs.title}`,
      location: { lat: gdacs.lat, lon: gdacs.lon, label: region || 'GDACS event area' },
      summary: 'GDACS combines event measurements with exposure and vulnerability models to estimate potential humanitarian impact. The alert is a model output, not confirmation of damage on the ground.',
      facts: [
        { label: 'Alert level', value: gdacs.alert, kind: 'interpretation' }, { label: 'Severity', value: gdacs.severity || '—', kind: 'observed' },
        { label: 'Impact model', value: 'Exposure + vulnerability', kind: 'verified' }, { label: 'Confirmed damage', value: 'Not established', kind: 'question' }
      ],
      sources: [src('GDACS disaster alert feed', gdacs.link || 'https://www.gdacs.org/')], related: ['Exposure model', 'Weather context', 'Relief data']
    });
  }

  const latestKp = Array.isArray(kp?.[0]) ? kp.filter(Array.isArray).slice(1).at(-1) : kp?.at(-1);
  if (latestKp) out.push({ id: 'aurora-watch', template: 'atmosphere', title: 'Aurora conditions are being measured above the polar night', kicker: 'NOAA space weather', visual: 'aurora', score: 74 + Number(latestKp?.Kp ?? latestKp?.[1] ?? 0) * 3, freshness: 'updated minutes ago', mediaImage: 'https://services.swpc.noaa.gov/images/aurora-forecast-northern-hemisphere.jpg', mediaAlt: 'NOAA northern hemisphere aurora forecast', location: { lat: 64.2, lon: -21.1, label: 'Iceland / polar oval' }, summary: 'The planetary K index is a real-time geomagnetic measurement. Aurora visibility still depends on darkness and cloud cover, so Elsewhere labels the opportunity as conditional rather than a promise.', facts: [
    { label: 'Kp index', value: String(latestKp?.Kp ?? latestKp?.[1] ?? "—"), kind: 'observed' }, { label: 'Visibility', value: 'Depends on clouds and darkness', kind: 'interpretation' }, { label: 'Camera match', value: 'Needs local verification', kind: 'question' }
  ], sources: [src('NOAA SWPC K-index', 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'), src('NOAA aurora forecast', 'https://www.swpc.noaa.gov/products/aurora-30-minute-forecast')], related: ['Cloud cover', 'Northern webcams', 'Solar wind speed'] });

  const flightRows = flights?.ac ?? [];
  const flightCount = flights?.total ?? flightRows.length;
  if (flightCount) {
    const altitudes = flightRows.map((a: any) => Number(a.alt_baro)).filter(Number.isFinite).sort((a: number, b: number) => a - b);
    const middle = Math.floor(altitudes.length / 2);
    const medianAltitude = altitudes.length ? (altitudes.length % 2 ? altitudes[middle] : (altitudes[middle - 1] + altitudes[middle]) / 2) : 0;
    const feedAge = flights?.now ? Math.max(0, (Date.now() - Number(flights.now)) / 1000) : 0;
    const latestSeen = Math.min(...flightRows.map((a: any) => Number(a.seen_pos ?? a.seen ?? 30)).filter(Number.isFinite)) + feedAge;
    out.push({ id: 'tokyo-air-corridor', template: 'city', title: 'Aircraft are threading through Tokyo’s sky right now', kicker: 'Live ADS-B aggregation', visual: 'city', score: 74 + Math.min(10, flightCount / 20), freshness: Number.isFinite(latestSeen) ? `positions ~${Math.max(0, Math.round(latestSeen))}s old` : 'live feed', location: { lat: 35.68, lon: 139.69, label: 'Tokyo airspace, aggregated' }, summary: 'Public ADS-B receivers are seeing aircraft around Tokyo. Elsewhere aggregates the traffic instead of exposing individual aircraft identifiers; coverage is crowdsourced and not authoritative air-traffic control data.', facts: [
      { label: 'Aircraft in sample', value: String(flightCount), kind: 'observed' }, { label: 'Median altitude', value: `${Math.round(medianAltitude / 100) / 10}k ft`, kind: 'observed' }, { label: 'Newest position', value: Number.isFinite(latestSeen) ? `~${Math.max(0, Math.round(latestSeen))}s old at retrieval` : 'Unknown', kind: 'observed' }, { label: 'Coverage', value: 'Crowdsourced receivers', kind: 'interpretation' }
    ], sources: [src('adsb.lol open ADS-B API', 'https://api.adsb.lol/')], related: ['City cameras', 'Night lights', 'Transit pulse'] });
  }

  const wave = marine?.current;
  if (wave) out.push({ id: 'nazare-swell', template: 'ocean', title: 'Atlantic swell is reorganizing the edge of Portugal', kicker: 'Near-real-time ocean model', visual: 'ocean', score: 68 + Math.min(16, Number(wave.wave_height ?? 0) * 4), freshness: ago(wave.time), location: { lat: 39.6, lon: -9.07, label: 'Nazaré, Portugal' }, summary: 'A high-resolution ocean model estimates waves and swell off Nazaré, a coastline famous for amplifying Atlantic energy. These are model values, not a buoy observation.', facts: [
    { label: 'Wave height', value: `${Number(wave.wave_height ?? 0).toFixed(1)} m`, kind: 'interpretation' }, { label: 'Swell period', value: `${Math.round(wave.swell_wave_period ?? wave.wave_period ?? 0)} s`, kind: 'interpretation' }, { label: 'Data type', value: 'Numerical ocean model', kind: 'verified' }, { label: 'Breaking surf', value: 'Not proven', kind: 'question' }
  ], sources: [src('Open-Meteo marine API', 'https://open-meteo.com/en/docs/marine-weather-api')], related: ['Storm surge', 'Coastal cameras', 'Golden Gate currents'] });

  const carbonNow = carbon?.data?.[0]?.intensity;
  const mix = generation?.data?.generationmix ?? [];
  const windShare = mix.find((m: any) => m.fuel === 'wind')?.perc ?? 0;
  const gasShare = mix.find((m: any) => m.fuel === 'gas')?.perc ?? 0;
  if (carbonNow || mix.length) out.push({ id: 'uk-grid-wind-pulse', template: 'city', title: 'Britain’s electricity mix is shifting in half-hourly pulses', kicker: 'Live grid carbon intensity', visual: 'city', score: 58 + windShare / 4, freshness: generation?.data?.from ? ago(generation.data.from) : 'half-hourly', location: { lat: 52.5, lon: -1.8, label: 'Great Britain electricity grid' }, summary: 'The UK grid publishes current carbon intensity and generation mix. This is a systems view of weather, infrastructure and demand interacting in near-real time.', facts: [
    { label: 'Carbon intensity', value: carbonNow?.actual ? `${carbonNow.actual} gCO₂/kWh` : carbonNow?.forecast ? `${carbonNow.forecast} forecast` : '—', kind: carbonNow?.actual ? 'observed' : 'interpretation' }, { label: 'Wind share', value: `${windShare}%`, kind: 'observed' }, { label: 'Gas share', value: `${gasShare}%`, kind: 'observed' }, { label: 'Grid stress', value: 'Not inferable', kind: 'question' }
  ], sources: [src('Carbon Intensity API', 'https://carbonintensity.org.uk/')], related: ['Grid weather context', 'Night lights', 'Historical comparison'] });

  if (tokyo?.current) out.push({ id: 'tokyo-waking', mediaVideo: 'https://www.youtube.com/embed/5B4LmH4JbnY?rel=0&autoplay=1&mute=1&playsinline=1', template: 'city', title: 'Tokyo is moving through its evening atmosphere', kicker: 'Open-Meteo city pulse', visual: 'city', score: 66, freshness: 'current conditions', location: { lat: 35.68, lon: 139.69, label: 'Tokyo' }, summary: 'Weather, air quality, aircraft activity and local time combine into a portrait of a megacity changing state. Air quality is modeled current data, not a direct roadside sensor reading.', facts: [
    { label: 'Temperature', value: `${Math.round(tokyo.current.temperature_2m)}°C`, kind: 'observed' }, { label: 'Wind', value: `${Math.round(tokyo.current.wind_speed_10m)} km/h`, kind: 'observed' }, { label: 'PM2.5', value: tokyoAir?.current?.pm2_5 != null ? `${Math.round(tokyoAir.current.pm2_5)} μg/m³ model` : '—', kind: 'interpretation' }, { label: 'Sunrise', value: tokyo.daily?.sunrise?.[0]?.slice(11) ?? '—', kind: 'verified' }
  ], sources: [src('Open-Meteo', 'https://open-meteo.com/'), src('Open-Meteo air quality', 'https://open-meteo.com/en/docs/air-quality-api')], related: ['Transit pulse', 'City cameras', 'Night lights'] });
  if (namib?.current) out.push({
    id: 'namib-live-camera', template: 'atmosphere', title: 'A live camera is watching the Namib Desert breathe', kicker: 'Live landscape webcam', visual: 'city', score: 77,
    freshness: 'live camera + current weather', mediaVideo: 'https://www.youtube.com/embed/ydYDqZQpim8?rel=0&autoplay=1&mute=1&playsinline=1',
    location: { lat: -23.65, lon: 15.95, label: 'Namib Desert, Namibia' },
    summary: 'A public live camera looks across one of Earth’s oldest deserts while current model weather grounds the scene. The camera shows what is visible now; wildlife or movement is never guaranteed.',
    facts: [
      { label: 'Temperature', value: `${Math.round(namib.current.temperature_2m)}°C`, kind: 'observed' },
      { label: 'Wind', value: `${Math.round(namib.current.wind_speed_10m)} km/h`, kind: 'observed' },
      { label: 'Light', value: namib.current.is_day ? 'Daylight now' : 'Dark now', kind: 'observed' },
      { label: 'Wildlife', value: 'Possible, never promised', kind: 'question' }
    ],
    sources: [src('NamibCam YouTube live stream', 'https://www.youtube.com/watch?v=ydYDqZQpim8'), src('Open-Meteo current weather', 'https://open-meteo.com/')],
    related: ['Desert weather', 'Night cameras', 'Climate contrast']
  });

  const launch = launches?.results?.[0];
  if (launch) out.push({ id: `launch-${launch.id}`, entityId: launch.id, occurredAt: launch.net, template: 'launch', title: launch.name, kicker: 'Upcoming space mission', visual: 'launch', score: 70, freshness: launch.net ? until(launch.net) : 'scheduled', location: { lat: launch.pad?.latitude ?? 28.6, lon: launch.pad?.longitude ?? -80.6, label: launch.pad?.location?.name ?? launch.pad?.name ?? 'Launch complex' }, summary: `${launch.name} is scheduled from ${launch.pad?.name ?? 'a launch complex'}. Countdowns can change, so Elsewhere distinguishes the published schedule from confirmation.`, facts: [
    { label: 'Window', value: launch.net ? new Date(launch.net).toLocaleString() : 'TBD', kind: 'verified' }, { label: 'Status', value: launch.status?.name ?? 'Unknown', kind: 'verified' }, { label: 'Provider', value: launch.launch_service_provider?.name ?? 'Unknown', kind: 'verified' }
  ], sources: [src('Launch Library 2', 'https://thespacedevs.com/llapi')], related: ['Mission trajectory', 'Weather constraints', 'Pad cameras'] });
  return connectDiscoveries(out.sort((a, b) => b.score - a.score)).map(d => ({ ...d, retrieved } as Discovery));
}

export async function getInvestigations(): Promise<Investigation[]> {
  const ukraineCities = '50.45,49.99,48.46,46.48,49.84';
  const ukraineLons = '30.52,36.23,35.04,30.72,24.03';
  const currentYear = new Date().getFullYear();
  const [quake, hdx, ukraineNews, googleNewsXml, ukraineWeather, fts, unhcr, eonet, sudanNewsXml, sudanWeather, sudanFts, sudanUnhcr, sudanHdx] = await Promise.all([
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'),
    json<any>('https://data.humdata.org/api/3/action/package_search?q=ukraine&rows=12'),
    json<any>('https://api.gdeltproject.org/api/v2/doc/doc?query=ukraine%20conflict&mode=ArtList&maxrecords=30&format=json&timespan=24h'),
    text('https://news.google.com/rss/search?q=Ukraine%20conflict%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen'),
    json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${ukraineCities}&longitude=${ukraineLons}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FKyiv`),
    json<any>(`https://api.hpc.tools/v1/public/fts/flow?countryISO3=UKR&year=${currentYear}`),
    json<any>('https://api.unhcr.org/population/v1/population/?coo=UKR&limit=100'),
    json<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=6'),
    text('https://news.google.com/rss/search?q=Sudan%20conflict%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen'),
    json<any>('https://api.open-meteo.com/v1/forecast?latitude=15.50,13.63,12.05,19.62,15.45&longitude=32.56,25.35,24.88,37.22,36.40&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=Africa%2FKhartoum'),
    json<any>(`https://api.hpc.tools/v1/public/fts/flow?countryISO3=SDN&year=${currentYear}`),
    json<any>('https://api.unhcr.org/population/v1/population/?coo=SUD&limit=100'),
    json<any>('https://data.humdata.org/api/3/action/package_search?q=sudan%20AND%20NOT%20%22South%20Sudan%22&rows=12')
  ]);
  const q = quake?.features?.[0];
  const out: Investigation[] = [];
  const cityNames = ['Kyiv', 'Kharkiv', 'Dnipro', 'Odesa', 'Lviv'];
  const weatherRows = Array.isArray(ukraineWeather) ? ukraineWeather : ukraineWeather ? [ukraineWeather] : [];
  const cityWeather = weatherRows.map((row: any, i: number) => ({ city: cityNames[i] ?? `Point ${i + 1}`, current: row.current })).filter((row: any) => row.current);
  const gdeltArticles = ukraineNews?.articles ?? [];
  const googleArticles = parseGoogleNews(googleNewsXml);
  const articles = gdeltArticles.length ? gdeltArticles : googleArticles;
  const attentionSource = gdeltArticles.length ? 'GDELT' : googleArticles.length ? 'Google News RSS' : 'unavailable';
  const countries = new Set(articles.map((a: any) => a.sourcecountry).filter(Boolean));
  const languages = new Set(articles.map((a: any) => a.language).filter(Boolean));
  const domains = new Set(articles.map((a: any) => a.domain).filter(Boolean));
  const articleTimes = articles.map((article: any) => newsTime(article.seendate)).filter(Number.isFinite);
  const latestArticleTime = articleTimes.length ? Math.max(...articleTimes) : NaN;
  const latestCoverage = Number.isFinite(latestArticleTime) ? ago(latestArticleTime) : 'unknown';
  const lastHourCoverage = articleTimes.filter((time: number) => Date.now() - time < 1000 * 60 * 70).length;
  const military = articles.filter((a: any) => /strike|missile|drone|attack|front|war|air raid|defen[cs]e/i.test(a.title ?? '')).length;
  const diplomacy = articles.filter((a: any) => /peace|talks|ceasefire|aid|funding|minister|negotiat/i.test(a.title ?? '')).length;
  const coldest = cityWeather.reduce((a: any, b: any) => !a || b.current.apparent_temperature < a.current.apparent_temperature ? b : a, null);
  const windiest = cityWeather.reduce((a: any, b: any) => !a || b.current.wind_speed_10m > a.current.wind_speed_10m ? b : a, null);
  const funding = fts?.data?.incoming?.fundingTotal ?? 0;
  const pledges = fts?.data?.incoming?.pledgeTotal ?? 0;
  const flowCount = fts?.data?.incoming?.flowCount ?? 0;
  const displacementRows = unhcr?.items ?? [];
  const latestDisplacement = displacementRows.reduce((a: any, b: any) => Number(b.year) > Number(a?.year ?? 0) ? b : a, displacementRows[0]);
  const priorDisplacement = latestDisplacement ? displacementRows.find((row: any) => Number(row.year) === Number(latestDisplacement.year) - 1) : null;
  const num = (value: any) => Number(value) || 0;
  const idpNow = num(latestDisplacement?.idps);
  const idpBefore = num(priorDisplacement?.idps);
  const refugeesNow = num(latestDisplacement?.refugees);
  const idpDelta = idpNow - idpBefore;
  const datasets = hdx?.result?.results ?? [];
  const datasetCount = hdx?.result?.count ?? datasets.length ?? 0;
  const freshDatasets = datasets.filter((d: any) => Date.now() - new Date(d.metadata_modified ?? 0).getTime() < 1000 * 60 * 60 * 24 * 30).length;

  if (cityWeather.length || articles.length || funding) {
    const coldStress = coldest && coldest.current.apparent_temperature <= 0;
    const attentionBreadth = gdeltArticles.length ? countries.size : domains.size;
    const evidenceStrength = [cityWeather.length >= 4, articles.length >= 8, funding > 0, datasetCount > 100].filter(Boolean).length;
    out.unshift({
      id: 'ukraine-live-signal',
      title: 'Ukraine: what the live public record can — and cannot — say',
      dek: 'A country-level synthesis of current weather stress, global attention patterns, humanitarian funding flows and public datasets. It intentionally avoids tactical battlefield tracking and instead asks what conditions mean for civilians and infrastructure resilience.',
      status: evidenceStrength >= 3 ? 'developing' : 'uncertain',
      location: { lat: 49.2, lon: 31.4, label: 'Ukraine, country-level synthesis' },
      updatedAt: now(),
      confidence: 42 + evidenceStrength * 11,
      metrics: [
        { label: 'Coldest feels-like', value: coldest ? `${Math.round(coldest.current.apparent_temperature)}°C` : '—', delta: coldest ? coldest.city : '5-city grid' },
        { label: 'Attention breadth', value: articles.length ? (gdeltArticles.length ? `${attentionBreadth} countries` : `${domains.size} outlets`) : 'unavailable', delta: articles.length ? `${articles.length} ${attentionSource} items / 24h · latest ${latestCoverage}` : 'attention sources unavailable' },
        { label: 'Humanitarian funding', value: funding ? `$${(funding / 1e9).toFixed(2)}B` : '—', delta: `${flowCount} FTS flows in ${currentYear}` },
        { label: 'Displaced people', value: idpNow ? `${(idpNow / 1e6).toFixed(1)}M IDPs` : '—', delta: latestDisplacement ? `${(refugeesNow / 1e6).toFixed(1)}M refugees abroad · ${latestDisplacement.year}` : 'UNHCR' },
        { label: 'Public datasets', value: String(datasetCount), delta: `${freshDatasets} updated in sample / 30d` }
      ],
      evidence: [
        { kind: 'observed', text: `Across a five-city Open-Meteo grid, ${coldest?.city ?? 'the coldest sampled city'} currently feels like ${coldest ? Math.round(coldest.current.apparent_temperature) : '—'}°C; ${windiest?.city ?? 'the windiest sampled city'} has ${windiest ? Math.round(windiest.current.wind_speed_10m) : '—'} km/h winds. This is current weather, not a damage report.` },
        { kind: 'observed', text: articles.length ? `${articles.length} recent Ukraine-related items came from ${domains.size} outlets/domains${gdeltArticles.length ? ` in ${countries.size} source countries and ${languages.size} languages` : ''} via ${attentionSource}. Rough title analysis: ${military} conflict-related and ${diplomacy} diplomacy/aid-related mentions; ${lastHourCoverage} items appear within roughly the latest hour.` : 'Both attention samples were unavailable at retrieval time, so no claim is made about current article volume.', source: gdeltArticles.length ? 'https://www.gdeltproject.org/' : 'https://news.google.com/' },
        { kind: 'verified', text: `OCHA FTS reports $${(funding / 1e9).toFixed(2)}B in ${currentYear} incoming humanitarian funding for Ukraine across ${flowCount} flows, plus $${(pledges / 1e6).toFixed(0)}M in pledges.`, source: 'https://fts.unocha.org/' },
        { kind: 'verified', text: latestDisplacement ? `UNHCR population statistics for origin-country Ukraine list ${idpNow.toLocaleString()} internally displaced people and ${refugeesNow.toLocaleString()} refugees abroad in ${latestDisplacement.year}; IDPs are ${idpDelta >= 0 ? 'up' : 'down'} ${Math.abs(idpDelta).toLocaleString()} versus ${Number(latestDisplacement.year) - 1}. These are stock estimates and can reflect methodological revisions, not just movement.` : 'UNHCR displacement data was unavailable at retrieval time.', source: 'https://www.unhcr.org/refugee-statistics/' },
        { kind: 'verified', text: `HDX indexes ${datasetCount} Ukraine-related datasets; ${freshDatasets} in the sampled first page were modified within the last 30 days. Dataset availability is not the same as field verification.`, source: 'https://data.humdata.org/' },
        { kind: 'interpretation', text: coldStress ? 'Sub-zero feels-like conditions make heating, grid resilience, shelter and transport disruption especially consequential; however, these public feeds do not prove outages or localized harm.' : 'Current sampled weather does not indicate exceptional cold stress countrywide; attention and humanitarian data still matter independently.' },
        { kind: 'interpretation', text: articles.length ? (attentionBreadth >= 8 ? 'Broad international attention increases the chance that major developments are independently corroborated, but volume also creates repetition and noise. Source diversity is stronger evidence than raw article count.' : 'Limited international attention makes corroboration weaker; absence of coverage should not be read as absence of events.') : 'Because the attention sample is unavailable, the investigation relies more heavily on direct weather, funding and dataset observations.' },
        { kind: 'interpretation', text: articles.length && idpNow ? `The scale of displacement (${(idpNow / 1e6).toFixed(1)}M IDPs) is structural regardless of whether today’s ${articles.length}-article attention sample is large or small. News volume measures attention cycles, not humanitarian magnitude.` : 'Humanitarian magnitude cannot be inferred from news volume; displacement statistics and current attention measure different things.' },
        { kind: 'question', text: 'What independent, appropriately aggregated evidence about power availability, heating access, displacement and civilian harm would corroborate or contradict the apparent level of stress?' },
        { kind: 'question', text: 'Which stories are being repeated across outlets, and which are independently observed? Elsewhere does not treat republished narratives as separate evidence.' }
      ],
      sources: [
        { label: 'Open-Meteo current weather', url: 'https://open-meteo.com/' },
        { label: `${attentionSource} 24h Ukraine attention sample`, url: gdeltArticles.length ? 'https://www.gdeltproject.org/' : 'https://news.google.com/' },
        { label: 'OCHA Financial Tracking Service', url: 'https://fts.unocha.org/' },
        { label: 'Humanitarian Data Exchange', url: 'https://data.humdata.org/' },
        { label: 'UNHCR Refugee Data Finder', url: 'https://www.unhcr.org/refugee-statistics/' }
      ]
    });
  }

  const sudanCities = ['Khartoum', 'El Fasher', 'Nyala', 'Port Sudan', 'Kassala'];
  const sudanRows = Array.isArray(sudanWeather) ? sudanWeather : sudanWeather ? [sudanWeather] : [];
  const sudanCityWeather = sudanRows.map((row: any, i: number) => ({ city: sudanCities[i] ?? `Point ${i + 1}`, current: row.current })).filter((row: any) => row.current);
  const sudanArticles = parseGoogleNews(sudanNewsXml).filter((article: any) => {
    const title = article.title ?? '';
    return /sudan/i.test(title) && !/south sudan/i.test(title) && /war|conflict|rsf|army|saf|attack|strike|violence|aid|humanitarian|ceasefire|peace|displace|hunger|famine|refugee/i.test(title);
  });
  const sudanDomains = new Set(sudanArticles.map((a: any) => a.domain).filter(Boolean));
  const sudanArticleTimes = sudanArticles.map((article: any) => newsTime(article.seendate)).filter(Number.isFinite);
  const sudanLatestCoverage = sudanArticleTimes.length ? ago(Math.max(...sudanArticleTimes)) : 'unknown';
  const sudanMilitary = sudanArticles.filter((a: any) => /strike|missile|drone|attack|front|war|violence|rsf|army|defen[cs]e/i.test(a.title ?? '')).length;
  const sudanDiplomacy = sudanArticles.filter((a: any) => /peace|talks|ceasefire|aid|funding|minister|negotiat|humanitarian/i.test(a.title ?? '')).length;
  const hottestSudan = sudanCityWeather.reduce((a: any, b: any) => !a || b.current.apparent_temperature > a.current.apparent_temperature ? b : a, null);
  const windiestSudan = sudanCityWeather.reduce((a: any, b: any) => !a || b.current.wind_speed_10m > a.current.wind_speed_10m ? b : a, null);
  const sudanFunding = sudanFts?.data?.incoming?.fundingTotal ?? 0;
  const sudanFlowCount = sudanFts?.data?.incoming?.flowCount ?? 0;
  const sudanDisplacementRows = sudanUnhcr?.items ?? [];
  const latestSudanDisplacement = sudanDisplacementRows.reduce((a: any, b: any) => Number(b.year) > Number(a?.year ?? 0) ? b : a, sudanDisplacementRows[0]);
  const priorSudanDisplacement = latestSudanDisplacement ? sudanDisplacementRows.find((row: any) => Number(row.year) === Number(latestSudanDisplacement.year) - 1) : null;
  const sudanIdps = num(latestSudanDisplacement?.idps);
  const sudanPriorIdps = num(priorSudanDisplacement?.idps);
  const sudanRefugees = num(latestSudanDisplacement?.refugees);
  const sudanIdpDelta = sudanIdps - sudanPriorIdps;
  const sudanDatasets = sudanHdx?.result?.results ?? [];
  const sudanDatasetCount = sudanHdx?.result?.count ?? sudanDatasets.length ?? 0;
  const sudanFreshDatasets = sudanDatasets.filter((d: any) => Date.now() - new Date(d.metadata_modified ?? 0).getTime() < 1000 * 60 * 60 * 24 * 30).length;
  const sudanFundingPerIdp = sudanFunding && sudanIdps ? sudanFunding / sudanIdps : 0;
  const comparableAttentionSamples = !gdeltArticles.length && articles.length > 0 && articles.length < 100 && sudanArticles.length > 0 && sudanArticles.length < 100;
  const ukraineAttentionPerMillion = comparableAttentionSamples && idpNow ? articles.length / (idpNow / 1e6) : NaN;
  const sudanAttentionPerMillion = sudanArticles.length && sudanIdps ? sudanArticles.length / (sudanIdps / 1e6) : NaN;
  const attentionContrast = Number.isFinite(ukraineAttentionPerMillion) && Number.isFinite(sudanAttentionPerMillion) && sudanAttentionPerMillion > 0 ? ukraineAttentionPerMillion / sudanAttentionPerMillion : NaN;

  if (sudanCityWeather.length || sudanArticles.length || sudanFunding) {
    const evidenceStrength = [sudanCityWeather.length >= 4, sudanArticles.length >= 8, sudanFunding > 0, sudanIdps > 0, sudanDatasetCount > 100].filter(Boolean).length;
    out.push({
      id: 'sudan-attention-gap',
      title: 'Sudan: a vast displacement crisis moving through a thin attention window',
      dek: 'A non-tactical humanitarian signal comparing current heat and weather exposure, one-day global attention, funding flow and UNHCR displacement scale. It is designed to reveal attention gaps rather than track battlefield positions.',
      status: evidenceStrength >= 4 ? 'developing' : 'uncertain',
      location: { lat: 15.6, lon: 30.4, label: 'Sudan, country-level synthesis' },
      updatedAt: now(),
      confidence: 44 + evidenceStrength * 9,
      metrics: [
        { label: 'Hottest feels-like', value: hottestSudan ? `${Math.round(hottestSudan.current.apparent_temperature)}°C` : '—', delta: hottestSudan ? hottestSudan.city : '5-city grid' },
        { label: 'Attention breadth', value: sudanArticles.length ? `${sudanDomains.size} outlets` : 'unavailable', delta: sudanArticles.length ? `${sudanArticles.length} Google News items / 24h · latest ${sudanLatestCoverage}` : 'attention unavailable' },
        { label: 'Humanitarian funding', value: sudanFunding ? `$${(sudanFunding / 1e9).toFixed(2)}B` : '—', delta: `${sudanFlowCount} FTS flows in ${currentYear}` },
        { label: 'Displaced people', value: sudanIdps ? `${(sudanIdps / 1e6).toFixed(1)}M IDPs` : '—', delta: latestSudanDisplacement ? `${(sudanRefugees / 1e6).toFixed(1)}M refugees abroad · ${latestSudanDisplacement.year}` : 'UNHCR' },
        { label: 'Funding per IDP', value: sudanFundingPerIdp ? `$${Math.round(sudanFundingPerIdp)}` : '—', delta: 'rough ratio, not allocation' },
        { label: 'Attention / million IDPs', value: Number.isFinite(sudanAttentionPerMillion) ? sudanAttentionPerMillion.toFixed(1) : '—', delta: Number.isFinite(ukraineAttentionPerMillion) ? `Ukraine sample ${ukraineAttentionPerMillion.toFixed(1)}` : 'comparison unavailable' }
      ],
      evidence: [
        { kind: 'observed', text: `Across the sampled Sudan grid, ${hottestSudan?.city ?? 'the hottest sampled city'} currently feels like ${hottestSudan ? Math.round(hottestSudan.current.apparent_temperature) : '—'}°C; ${windiestSudan?.city ?? 'the windiest sampled city'} has ${windiestSudan ? Math.round(windiestSudan.current.wind_speed_10m) : '—'} km/h winds. This is current environmental exposure, not a damage report.` },
        { kind: 'observed', text: sudanArticles.length ? `${sudanArticles.length} recent Sudan-conflict-related items came from ${sudanDomains.size} outlets/domains via Google News RSS. Rough title analysis: ${sudanMilitary} conflict-related and ${sudanDiplomacy} diplomacy/aid-related mentions; latest item is ${sudanLatestCoverage}.` : 'The Sudan attention sample was unavailable at retrieval time, so no claim is made about current article volume.', source: 'https://news.google.com/' },
        { kind: 'verified', text: `OCHA FTS reports $${(sudanFunding / 1e9).toFixed(2)}B in ${currentYear} incoming humanitarian funding for Sudan across ${sudanFlowCount} flows.`, source: 'https://fts.unocha.org/' },
        { kind: 'verified', text: latestSudanDisplacement ? `UNHCR population statistics for origin-country Sudan list ${sudanIdps.toLocaleString()} internally displaced people and ${sudanRefugees.toLocaleString()} refugees abroad in ${latestSudanDisplacement.year}; IDPs are ${sudanIdpDelta >= 0 ? 'up' : 'down'} ${Math.abs(sudanIdpDelta).toLocaleString()} versus ${Number(latestSudanDisplacement.year) - 1}. These are stock estimates and can reflect methodological revisions, not just movement.` : 'UNHCR displacement data was unavailable at retrieval time.', source: 'https://www.unhcr.org/refugee-statistics/' },
        { kind: 'verified', text: `HDX indexes ${sudanDatasetCount} Sudan-related datasets; ${sudanFreshDatasets} in the sampled first page were modified within the last 30 days. Dataset availability is not the same as field verification.`, source: 'https://data.humdata.org/' },
        { kind: 'interpretation', text: hottestSudan && hottestSudan.current.apparent_temperature >= 38 ? 'Extreme feels-like heat makes displacement, water access, shelter and transport more dangerous; these public feeds do not prove conditions in any specific camp or city.' : 'Current sampled heat is important context but not extreme across the whole grid; humanitarian exposure still depends on shelter, water and security conditions.' },
        { kind: 'interpretation', text: sudanArticles.length && sudanIdps ? `The central signal is asymmetry: ${(sudanIdps / 1e6).toFixed(1)}M IDPs are represented through a 24-hour sample of only ${sudanArticles.length} attention items${Number.isFinite(attentionContrast) ? `, about ${attentionContrast.toFixed(1)}× less attention per million IDPs than Ukraine in today’s samples` : ''}. That does not mean events are absent; it means the global public record may be thin relative to human scale.` : 'News volume and displacement measure different things, so a small attention sample cannot be treated as evidence of low humanitarian severity.' },
        { kind: 'interpretation', text: sudanFundingPerIdp ? `Dividing total FTS funding by IDPs gives roughly $${Math.round(sudanFundingPerIdp)} per displaced person, but this is only a scale comparison: FTS funding is not allocated exclusively or evenly to IDPs.` : 'Funding per displaced person cannot be calculated because one of the inputs is unavailable.' },
        { kind: 'question', text: 'Which local, appropriately aggregated sources could corroborate access to water, food, health care and safe movement without exposing vulnerable people or tactical positions?' },
        { kind: 'question', text: 'How much coverage is independent reporting versus repetition of the same wire copy or institutional statements?' }
      ],
      sources: [
        { label: 'Open-Meteo current weather', url: 'https://open-meteo.com/' },
        { label: 'Google News RSS 24h Sudan attention sample', url: 'https://news.google.com/' },
        { label: 'OCHA Financial Tracking Service', url: 'https://fts.unocha.org/' },
        { label: 'Humanitarian Data Exchange', url: 'https://data.humdata.org/' },
        { label: 'UNHCR Refugee Data Finder', url: 'https://www.unhcr.org/refugee-statistics/' }
      ]
    });
  }

  if (q) {
    const [lon, lat, depth] = q.geometry.coordinates;
    out.push({ id: 'seismic-ripple', title: 'What follows a significant earthquake?', dek: 'An evidence-first reconstruction combining USGS observations, humanitarian-data availability and attention gaps.', status: 'uncertain', location: { lat, lon, label: q.properties.place }, updatedAt: new Date(q.properties.time).toISOString(), confidence: 52, metrics: [
      { label: 'Magnitude', value: q.properties.mag?.toFixed(1) ?? '—' }, { label: 'Depth', value: `${Math.round(depth)} km` }, { label: 'Felt reports', value: String(q.properties.felt ?? 0), delta: 'USGS crowd reports' }, { label: 'Impact evidence', value: 'Unresolved', delta: 'needs corroboration' }
    ], evidence: [
      { kind: 'observed', text: `USGS recorded magnitude ${q.properties.mag?.toFixed(1)} at ${Math.round(depth)} km depth near ${q.properties.place}.`, source: q.properties.url },
      { kind: 'interpretation', text: 'Humanitarian consequence cannot be inferred from magnitude alone; depth, exposure, building stock and reporting lag matter.' },
      { kind: 'question', text: 'What independent evidence would show whether infrastructure, shelter or lifeline services are deteriorating?' }
    ], sources: [{ label: 'USGS significant earthquakes', url: 'https://earthquake.usgs.gov/' }, { label: 'Humanitarian Data Exchange', url: 'https://data.humdata.org/' }] });
  }
  const evt = eonet?.events?.[0];
  if (evt) out.push({ id: 'event-attention-gap', title: 'Which natural events are being missed?', dek: 'NASA event observations are compared with broad public attention to surface stories that may be under-covered.', status: 'uncertain', location: { lat: evt.geometry?.at(-1)?.coordinates?.[1] ?? 0, lon: evt.geometry?.at(-1)?.coordinates?.[0] ?? 0, label: evt.title }, updatedAt: evt.geometry?.at(-1)?.date ?? now(), confidence: 48, metrics: [
    { label: 'Open events', value: String(eonet?.events?.length ?? 0) }, { label: 'Attention proxy', value: String(articles.length), delta: 'Ukraine sample reuse' }, { label: 'Evidence quality', value: 'Mixed', delta: 'source-dependent' }
  ], evidence: [
    { kind: 'observed', text: `NASA EONET is tracking ${evt.title} as an open natural event.` },
    { kind: 'interpretation', text: 'Low media attention does not imply low consequence; it creates a research question worth investigating.' },
    { kind: 'question', text: 'Can satellite imagery, weather observations or humanitarian reports corroborate change on the ground?' }
  ], sources: [{ label: 'NASA EONET', url: 'https://eonet.gsfc.nasa.gov/' }, { label: 'GDELT', url: 'https://www.gdeltproject.org/' }] });
  return out;
}
