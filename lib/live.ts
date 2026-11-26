import type { Discovery, Investigation } from './types';
import { ago } from './time';

const now = () => new Date().toISOString();
const src = (label: string, url: string) => ({ label, url, retrievedAt: now() });
async function json<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, { signal: controller.signal, ...init, next: { revalidate: 180 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
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

function connectionReason(a: Discovery, b: Discovery): string | null {
  const pair = [a.id, b.id].join('|');
  if (pair.includes('solar-wind') && pair.includes('aurora-watch')) return 'Solar wind and magnetic orientation upstream can shape aurora conditions downstream.';
  if (pair.includes('solar-wind') && pair.includes('iss-over-earth')) return 'Both are part of the same near-Earth space environment.';
  if (pair.includes('launch') && pair.includes('solar-wind')) return 'Space weather is operational context for spacecraft and communications, not a launch decision by itself.';
  if (pair.includes('tokyo-air-corridor') && pair.includes('tokyo-waking')) return 'Aviation, weather and air quality are simultaneous layers over the same megacity.';
  if (pair.includes('nazare-swell') && pair.includes('storm')) return 'Ocean waves and storm systems can share atmospheric forcing.';
  if (a.template === 'geology' && b.template === 'ocean' || b.template === 'geology' && a.template === 'ocean') return 'Coastal earthquakes raise a tsunami evidence question, but do not establish one.';
  if (a.template === 'wildfire' && b.template === 'atmosphere' || b.template === 'wildfire' && a.template === 'atmosphere') return 'Weather can condition fire behavior, but wind alone does not prove spread.';
  const distance = angularDistance(a, b);
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
  const [iss, quakes, eonet, kp, launches, tides, tokyo, swepam, aceMag, xrays, marine, tokyoAir, flights, carbon, generation] = await Promise.all([
    json<any>('https://api.wheretheiss.at/v1/satellites/25544'),
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'),
    json<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=10'),
    json<any[]>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
    json<any>('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=4&mode=detailed'),
    json<any>('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=9414290&product=water_level&datum=MLLW&time_zone=gmt&units=english&format=json'),
    json<any>('https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto'),
    json<any[]>('https://services.swpc.noaa.gov/json/ace/swepam/ace_swepam_1h.json'),
    json<any[]>('https://services.swpc.noaa.gov/json/ace/mag/ace_mag_1h.json'),
    json<any[]>('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json'),
    json<any>('https://marine-api.open-meteo.com/v1/marine?latitude=39.6&longitude=-9.07&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period&timezone=auto'),
    json<any>('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=35.68&longitude=139.69&current=pm2_5,pm10,ozone,aerosol_optical_depth&timezone=auto'),
    json<any>('https://api.adsb.lol/v2/lat/35.68/lon/139.69/dist/100'),
    json<any>('https://api.carbonintensity.org.uk/intensity'),
    json<any>('https://api.carbonintensity.org.uk/generation')
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
  const latestKp = Array.isArray(kp?.[0]) ? kp.filter(Array.isArray).slice(1).at(-1) : kp?.at(-1);
  if (latestKp) out.push({ id: 'aurora-watch', template: 'atmosphere', title: 'Aurora conditions are being measured above the polar night', kicker: 'NOAA space weather', visual: 'aurora', score: 74 + Number(latestKp?.Kp ?? latestKp?.[1] ?? 0) * 3, freshness: 'updated minutes ago', mediaImage: 'https://services.swpc.noaa.gov/images/aurora-forecast-northern-hemisphere.jpg', mediaAlt: 'NOAA northern hemisphere aurora forecast', location: { lat: 64.2, lon: -21.1, label: 'Iceland / polar oval' }, summary: 'The planetary K index is a real-time geomagnetic measurement. Aurora visibility still depends on darkness and cloud cover, so Elsewhere labels the opportunity as conditional rather than a promise.', facts: [
    { label: 'Kp index', value: String(latestKp?.Kp ?? latestKp?.[1] ?? "—"), kind: 'observed' }, { label: 'Visibility', value: 'Depends on clouds and darkness', kind: 'interpretation' }, { label: 'Camera match', value: 'Needs local verification', kind: 'question' }
  ], sources: [src('NOAA SWPC K-index', 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'), src('NOAA aurora forecast', 'https://www.swpc.noaa.gov/products/aurora-30-minute-forecast')], related: ['Cloud cover', 'Northern webcams', 'Solar wind speed'] });

  const flightRows = flights?.ac ?? [];
  const flightCount = flights?.total ?? flightRows.length;
  if (flightCount) {
    const altitudes = flightRows.map((a: any) => Number(a.alt_baro)).filter(Number.isFinite).sort((a: number, b: number) => a - b);
    const medianAltitude = altitudes[Math.floor(altitudes.length / 2)] ?? 0;
    const latestSeen = Math.min(...flightRows.map((a: any) => Number(a.seen ?? 30)).filter(Number.isFinite));
    out.push({ id: 'tokyo-air-corridor', template: 'city', title: 'Aircraft are threading through Tokyo’s sky right now', kicker: 'Live ADS-B aggregation', visual: 'city', score: 74 + Math.min(10, flightCount / 20), freshness: latestSeen < 5 ? 'seconds ago' : 'live feed', location: { lat: 35.68, lon: 139.69, label: 'Tokyo airspace, aggregated' }, summary: 'Public ADS-B receivers are seeing aircraft around Tokyo. Elsewhere aggregates the traffic instead of exposing individual aircraft identifiers; coverage is crowdsourced and not authoritative air-traffic control data.', facts: [
      { label: 'Aircraft in sample', value: String(flightCount), kind: 'observed' }, { label: 'Median altitude', value: `${Math.round(medianAltitude / 100) / 10}k ft`, kind: 'observed' }, { label: 'Newest position', value: Number.isFinite(latestSeen) ? `${Math.max(0, Math.round(latestSeen))}s old` : 'Unknown', kind: 'observed' }, { label: 'Coverage', value: 'Crowdsourced receivers', kind: 'interpretation' }
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

  const tide = tides?.data?.[0];
  if (tide) out.push({ id: 'sf-tide-pulse', template: 'ocean', title: 'San Francisco Bay is breathing with the tide', kicker: 'NOAA coastal observation', visual: 'ocean', score: 48, freshness: ago(tide.t), location: { lat: 37.8, lon: -122.47, label: 'San Francisco Bay' }, summary: 'A tide gauge is measuring the bay right now. As supporting context, it becomes useful when connected to storm surge, tsunami questions or coastal infrastructure rather than treated as a standalone spectacle.', facts: [
    { label: 'Water level', value: `${tide.v} ft`, kind: 'observed' }, { label: 'Station', value: 'NOAA 9414290', kind: 'verified' }, { label: 'Coastal impact', value: 'Depends on local terrain', kind: 'interpretation' }
  ], sources: [src('NOAA CO-OPS', 'https://tidesandcurrents.noaa.gov/')], related: ['Golden Gate currents', 'Storm surge', 'Coastal cameras'] });
  if (tokyo?.current) out.push({ id: 'tokyo-waking', template: 'city', title: 'Tokyo is moving through its evening atmosphere', kicker: 'Open-Meteo city pulse', visual: 'city', score: 66, freshness: 'current conditions', location: { lat: 35.68, lon: 139.69, label: 'Tokyo' }, summary: 'Weather, air quality, aircraft activity and local time combine into a portrait of a megacity changing state. Air quality is modeled current data, not a direct roadside sensor reading.', facts: [
    { label: 'Temperature', value: `${Math.round(tokyo.current.temperature_2m)}°C`, kind: 'observed' }, { label: 'Wind', value: `${Math.round(tokyo.current.wind_speed_10m)} km/h`, kind: 'observed' }, { label: 'PM2.5', value: tokyoAir?.current?.pm2_5 != null ? `${Math.round(tokyoAir.current.pm2_5)} μg/m³ model` : '—', kind: 'interpretation' }, { label: 'Sunrise', value: tokyo.daily?.sunrise?.[0]?.slice(11) ?? '—', kind: 'verified' }
  ], sources: [src('Open-Meteo', 'https://open-meteo.com/'), src('Open-Meteo air quality', 'https://open-meteo.com/en/docs/air-quality-api')], related: ['Transit pulse', 'City cameras', 'Night lights'] });
  const launch = launches?.results?.[0];
  if (launch) out.push({ id: `launch-${launch.id}`, entityId: launch.id, occurredAt: launch.net, template: 'launch', title: launch.name, kicker: 'Upcoming space mission', visual: 'launch', score: 70, freshness: launch.net ? ago(launch.net).replace(' ago','') : 'scheduled', location: { lat: launch.pad?.latitude ?? 28.6, lon: launch.pad?.longitude ?? -80.6, label: launch.pad?.location?.name ?? launch.pad?.name ?? 'Launch complex' }, summary: `${launch.name} is scheduled from ${launch.pad?.name ?? 'a launch complex'}. Countdowns can change, so Elsewhere distinguishes the published schedule from confirmation.`, facts: [
    { label: 'Window', value: launch.net ? new Date(launch.net).toLocaleString() : 'TBD', kind: 'verified' }, { label: 'Status', value: launch.status?.name ?? 'Unknown', kind: 'verified' }, { label: 'Provider', value: launch.launch_service_provider?.name ?? 'Unknown', kind: 'verified' }
  ], sources: [src('Launch Library 2', 'https://thespacedevs.com/llapi')], related: ['Mission trajectory', 'Weather constraints', 'Pad cameras'] });
  return connectDiscoveries(out.sort((a, b) => b.score - a.score)).map(d => ({ ...d, retrieved } as Discovery));
}

export async function getInvestigations(): Promise<Investigation[]> {
  const ukraineCities = '50.45,49.99,48.46,46.48,49.84';
  const ukraineLons = '30.52,36.23,35.04,30.72,24.03';
  const [quake, hdx, ukraineNews, ukraineWeather, fts, eonet] = await Promise.all([
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'),
    json<any>('https://data.humdata.org/api/3/action/package_search?q=ukraine&rows=12'),
    json<any>('https://api.gdeltproject.org/api/v2/doc/doc?query=ukraine&mode=ArtList&maxrecords=30&format=json&timespan=24h'),
    json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${ukraineCities}&longitude=${ukraineLons}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FKyiv`),
    json<any>('https://api.hpc.tools/v1/public/fts/flow?countryISO3=UKR&year=2026'),
    json<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=6')
  ]);
  const q = quake?.features?.[0];
  const out: Investigation[] = [];
  const cityNames = ['Kyiv', 'Kharkiv', 'Dnipro', 'Odesa', 'Lviv'];
  const weatherRows = Array.isArray(ukraineWeather) ? ukraineWeather : ukraineWeather ? [ukraineWeather] : [];
  const cityWeather = weatherRows.map((row: any, i: number) => ({ city: cityNames[i] ?? `Point ${i + 1}`, current: row.current })).filter((row: any) => row.current);
  const articles = ukraineNews?.articles ?? [];
  const countries = new Set(articles.map((a: any) => a.sourcecountry).filter(Boolean));
  const languages = new Set(articles.map((a: any) => a.language).filter(Boolean));
  const domains = new Set(articles.map((a: any) => a.domain).filter(Boolean));
  const military = articles.filter((a: any) => /strike|missile|drone|attack|front|war|air raid|defen[cs]e/i.test(a.title ?? '')).length;
  const diplomacy = articles.filter((a: any) => /peace|talks|ceasefire|aid|funding|minister|negotiat/i.test(a.title ?? '')).length;
  const coldest = cityWeather.reduce((a: any, b: any) => !a || b.current.apparent_temperature < a.current.apparent_temperature ? b : a, null);
  const windiest = cityWeather.reduce((a: any, b: any) => !a || b.current.wind_speed_10m > a.current.wind_speed_10m ? b : a, null);
  const funding = fts?.data?.incoming?.fundingTotal ?? 0;
  const pledges = fts?.data?.incoming?.pledgeTotal ?? 0;
  const flowCount = fts?.data?.incoming?.flowCount ?? 0;
  const datasets = hdx?.result?.results ?? [];
  const datasetCount = hdx?.result?.count ?? datasets.length ?? 0;
  const freshDatasets = datasets.filter((d: any) => Date.now() - new Date(d.metadata_modified ?? 0).getTime() < 1000 * 60 * 60 * 24 * 30).length;

  if (cityWeather.length || articles.length || funding) {
    const coldStress = coldest && coldest.current.apparent_temperature <= 0;
    const attentionBreadth = countries.size;
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
        { label: 'Attention breadth', value: articles.length ? `${attentionBreadth} countries` : 'unavailable', delta: articles.length ? `${articles.length} GDELT articles / 24h` : 'GDELT rate-limited or empty' },
        { label: 'Humanitarian funding', value: funding ? `$${(funding / 1e9).toFixed(2)}B` : '—', delta: `${flowCount} FTS flows in 2026` },
        { label: 'Public datasets', value: String(datasetCount), delta: `${freshDatasets} updated in sample / 30d` }
      ],
      evidence: [
        { kind: 'observed', text: `Across a five-city Open-Meteo grid, ${coldest?.city ?? 'the coldest sampled city'} currently feels like ${coldest ? Math.round(coldest.current.apparent_temperature) : '—'}°C; ${windiest?.city ?? 'the windiest sampled city'} has ${windiest ? Math.round(windiest.current.wind_speed_10m) : '—'} km/h winds. This is current weather, not a damage report.` },
        { kind: 'observed', text: articles.length ? `${articles.length} recent GDELT-matched Ukraine articles came from ${domains.size} domains in ${countries.size} source countries and ${languages.size} languages. Rough title analysis: ${military} conflict-related and ${diplomacy} diplomacy/aid-related mentions.` : 'The GDELT attention sample was unavailable at retrieval time, so no claim is made about current article volume.', source: 'https://www.gdeltproject.org/' },
        { kind: 'verified', text: `OCHA FTS reports $${(funding / 1e9).toFixed(2)}B in 2026 incoming humanitarian funding for Ukraine across ${flowCount} flows, plus $${(pledges / 1e6).toFixed(0)}M in pledges.`, source: 'https://fts.unocha.org/' },
        { kind: 'verified', text: `HDX indexes ${datasetCount} Ukraine-related datasets; ${freshDatasets} in the sampled first page were modified within the last 30 days. Dataset availability is not the same as field verification.`, source: 'https://data.humdata.org/' },
        { kind: 'interpretation', text: coldStress ? 'Sub-zero feels-like conditions make heating, grid resilience, shelter and transport disruption especially consequential; however, these public feeds do not prove outages or localized harm.' : 'Current sampled weather does not indicate exceptional cold stress countrywide; attention and humanitarian data still matter independently.' },
        { kind: 'interpretation', text: articles.length ? (attentionBreadth >= 8 ? 'Broad international attention increases the chance that major developments are independently corroborated, but volume also creates repetition and noise. Source diversity is stronger evidence than raw article count.' : 'Limited international attention makes corroboration weaker; absence of coverage should not be read as absence of events.') : 'Because the attention sample is unavailable, the investigation relies more heavily on direct weather, funding and dataset observations.' },
        { kind: 'question', text: 'What independent, appropriately aggregated evidence about power availability, heating access, displacement and civilian harm would corroborate or contradict the apparent level of stress?' },
        { kind: 'question', text: 'Which stories are being repeated across outlets, and which are independently observed? Elsewhere does not treat republished narratives as separate evidence.' }
      ],
      sources: [
        { label: 'Open-Meteo current weather', url: 'https://open-meteo.com/' },
        { label: 'GDELT 24h Ukraine attention sample', url: 'https://www.gdeltproject.org/' },
        { label: 'OCHA Financial Tracking Service', url: 'https://fts.unocha.org/' },
        { label: 'Humanitarian Data Exchange', url: 'https://data.humdata.org/' }
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
