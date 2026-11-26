import { NextResponse } from 'next/server';

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

async function jsonLive<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}

async function text(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function xmlValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.trim() ?? '';
}

function weatherText(code?: number) {
  if (code == null) return 'Current conditions';
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return 'Partly to mostly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Changing weather';
}

function worldviewImage(lat: number, lon: number) {
  const centerLon = Math.max(-174, Math.min(174, lon));
  const latMin = Math.max(-75, lat - 4);
  const latMax = Math.min(75, lat + 4);
  const lonMin = centerLon - 6;
  const lonMax = centerLon + 6;
  return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&BBOX=${latMin.toFixed(2)}%2C${lonMin.toFixed(2)}%2C${latMax.toFixed(2)}%2C${lonMax.toFixed(2)}&CRS=EPSG%3A4326&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&FORMAT=image%2Fjpeg&WIDTH=900&HEIGHT=520`;
}

function distanceKm(latA: number, lonA: number, latB: number, lonB: number) {
  const rad = Math.PI / 180;
  const dLat = (latB - latA) * rad;
  const dLon = (lonB - lonA) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 });
  const [weather, place, air, quakes, gdacsXml, aircraftFeed] = await Promise.all([
    json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,cloud_cover,weather_code,wind_speed_10m,wind_direction_10m,is_day&daily=sunrise,sunset&timezone=auto`),
    json<any>(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`, { headers: { 'User-Agent': 'Elsewhere/0.1 (https://elsewhere-discover-nine.vercel.app)' } }),
    json<any>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,ozone&timezone=auto`),
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'),
    text('https://www.gdacs.org/xml/rss.xml'),
    jsonLive<any>(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/100`)
  ]);
  const current = weather?.current;
  const address = place?.address ?? {};
  const placeName = place?.display_name || [address.city, address.town, address.village, address.municipality, address.county, address.state, address.country].filter(Boolean).join(', ') || (Math.abs(lat) > 66 ? 'Polar region' : 'Open ocean / unpopulated area');
  const nearbyQuakes = (quakes?.features ?? [])
    .map((feature: any) => ({ feature, distance: distanceKm(lat, lon, feature.geometry?.coordinates?.[1], feature.geometry?.coordinates?.[0]) }))
    .filter((row: any) => Number.isFinite(row.distance) && row.distance <= 500)
    .sort((a: any, b: any) => a.distance - b.distance);
  const nearestQuake = nearbyQuakes[0];
  const gdacsEvents = (gdacsXml ? [...gdacsXml.matchAll(/<item>([\s\S]*?)<\/item>/g)] : [])
    .map(match => {
      const block = match[1];
      return { title: xmlValue(block, 'title'), alert: xmlValue(block, 'gdacs:alertlevel') || 'Green', type: xmlValue(block, 'gdacs:eventtype'), lat: Number(xmlValue(block, 'geo:lat')), lon: Number(xmlValue(block, 'geo:long')), current: xmlValue(block, 'gdacs:iscurrent') };
    })
    .filter(event => Number.isFinite(event.lat) && Number.isFinite(event.lon) && event.current !== 'false')
    .map(event => ({ ...event, distance: distanceKm(lat, lon, event.lat, event.lon) }))
    .filter(event => event.distance <= 1000)
    .sort((a, b) => a.distance - b.distance);
  const nearestHazard = gdacsEvents[0];
  const aircraft = (aircraftFeed?.ac ?? []).filter((plane: any) => Number.isFinite(plane.lat) && Number.isFinite(plane.lon));
  const nearestAircraft = aircraft
    .map((plane: any) => ({ ...plane, distance: distanceKm(lat, lon, plane.lat, plane.lon) }))
    .sort((a: any, b: any) => a.distance - b.distance)[0];
  const daylight = current?.is_day == null ? null : current.is_day ? 'Daylight now' : 'Dark now';
  const facts = [
    current ? { label: 'Weather', value: `${weatherText(current.weather_code)}, ${Math.round(current.temperature_2m)}°C`, kind: 'observed' } : { label: 'Weather', value: 'Unavailable', kind: 'question' },
    current ? { label: 'Wind', value: `${Math.round(current.wind_speed_10m)} km/h from ${Math.round(current.wind_direction_10m)}°`, kind: 'observed' } : null,
    current ? { label: 'Cloud cover', value: `${Math.round(current.cloud_cover)}%`, kind: 'observed' } : null,
    daylight ? { label: 'Light', value: daylight, kind: 'observed' } : null,
    weather?.daily?.sunrise?.[0] && weather?.daily?.sunset?.[0] ? { label: 'Sun rhythm', value: `${weather.daily.sunrise[0].slice(11, 16)} sunrise · ${weather.daily.sunset[0].slice(11, 16)} sunset`, kind: 'verified' } : null,
    current?.precipitation != null ? { label: 'Precipitation', value: `${Number(current.precipitation).toFixed(1)} mm now`, kind: 'observed' } : null,
    { label: 'Recent seismicity', value: nearbyQuakes.length ? `${nearbyQuakes.length} recorded within 500 km in 24h` : 'None recorded within 500 km in 24h', kind: nearbyQuakes.length ? 'observed' : 'verified' },
    nearestQuake ? { label: 'Nearest quake', value: `M${Number(nearestQuake.feature.properties?.mag ?? 0).toFixed(1)}, ${Math.round(nearestQuake.distance)} km away`, kind: 'observed' } : null,
    nearestHazard ? { label: 'Hazard model nearby', value: `${nearestHazard.alert} ${nearestHazard.type || 'event'}, ${Math.round(nearestHazard.distance)} km away`, kind: 'interpretation' } : { label: 'Hazard model nearby', value: 'No GDACS alert within 1,000 km', kind: 'verified' },
    { label: 'Aircraft overhead', value: !aircraftFeed ? 'ADS-B feed unavailable at retrieval time' : aircraft.length ? `${aircraft.length} live position reports within ~185 km` : 'No position reports returned; receiver coverage is not guaranteed', kind: aircraftFeed && aircraft.length ? 'observed' : 'question' },
    nearestAircraft ? { label: 'Nearest aircraft', value: `${(nearestAircraft.flight ?? nearestAircraft.hex ?? 'Unidentified').trim()} · ${Math.round(nearestAircraft.distance)} km away${Number.isFinite(nearestAircraft.alt_baro) ? ` at ${Math.round(nearestAircraft.alt_baro).toLocaleString()} ft` : ''}`, kind: 'observed' } : null,
    air?.current?.pm2_5 != null ? { label: 'PM2.5', value: `${Math.round(air.current.pm2_5)} μg/m³ model`, kind: 'interpretation' } : null,
    weather?.elevation != null ? { label: 'Elevation', value: `${Math.round(weather.elevation)} m`, kind: 'verified' } : null,
    weather?.timezone ? { label: 'Local timezone', value: weather.timezone.replace('_', ' '), kind: 'verified' } : null,
    { label: 'Satellite context', value: 'Latest daylight swath; orbital gaps possible', kind: 'observed' },
    { label: 'Attribution', value: 'Weather is model/grid data; reverse geocoding is approximate; populated places may be coarse', kind: 'question' }
  ].filter(Boolean);
  return NextResponse.json({
    place: {
      lat, lon, label: placeName,
      locality: address.city ?? address.town ?? address.village ?? place?.name, country: address.country,
      timezone: weather?.timezone,
      mediaImage: worldviewImage(lat, lon),
      mediaAlt: `NASA MODIS latest available true-color satellite swath around ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
      facts,
      sources: [
        { label: 'NASA Worldview MODIS satellite imagery', url: 'https://worldview.earthdata.nasa.gov/', retrievedAt: new Date().toISOString() },
        { label: 'Open-Meteo current weather', url: 'https://open-meteo.com/', retrievedAt: new Date().toISOString() },
        { label: 'OpenStreetMap Nominatim reverse geocode', url: 'https://nominatim.openstreetmap.org/', retrievedAt: new Date().toISOString() },
        { label: 'USGS 24-hour earthquake feed', url: 'https://earthquake.usgs.gov/earthquakes/feed/', retrievedAt: new Date().toISOString() },
        { label: 'GDACS current disaster alerts', url: 'https://www.gdacs.org/', retrievedAt: new Date().toISOString() },
        { label: 'adsb.lol live aircraft transponders', url: 'https://adsb.lol/', retrievedAt: new Date().toISOString() }
      ],
      retrievedAt: new Date().toISOString()
    }
  });
}
