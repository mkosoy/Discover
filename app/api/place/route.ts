import { NextResponse } from 'next/server';
import { earthImagery } from '@/lib/satellite';
import { nearestPublicCameras } from '@/lib/cameras';

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
  const [weather, place, air, quakes, gdacsXml, aircraftFeed, wiki] = await Promise.all([
    json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,cloud_cover,weather_code,wind_speed_10m,wind_direction_10m,is_day&daily=sunrise,sunset&timezone=auto`),
    json<any>(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`, { headers: { 'User-Agent': 'Elsewhere/0.1 (https://elsewhere-discover-nine.vercel.app)' } }),
    json<any>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,ozone&timezone=auto`),
    json<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'),
    text('https://www.gdacs.org/xml/rss.xml'),
    jsonLive<any>(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/100`),
    json<any>(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=4&format=json&origin=*`)
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
  const nearestCamera = nearestPublicCameras(lat, lon, 1)[0];
  const hook = nearestHazard && nearestHazard.distance < 250
    ? `This point sits within ${Math.round(nearestHazard.distance)} km of a ${nearestHazard.alert} ${nearestHazard.type || 'hazard'} model, while current weather, aircraft and satellite context explain what can and cannot be corroborated right now.`
    : nearestQuake && nearestQuake.distance < 150
      ? `This is a seismically active neighborhood: a magnitude ${Number(nearestQuake.feature.properties?.mag ?? 0).toFixed(1)} earthquake was recorded ${Math.round(nearestQuake.distance)} km away within the last day, alongside the local atmosphere and live overhead motion.`
      : aircraft.length >= 12
        ? `This point sits beneath a busy live air corridor, with ${aircraft.length} public aircraft position reports nearby layered over weather, sunlight and terrain.`
        : air?.current?.pm2_5 != null && air.current.pm2_5 >= 25
          ? `The most distinctive current signal is atmospheric: modeled PM2.5 is ${Math.round(air.current.pm2_5)} μg/m³, making air quality, wind transport and visibility the questions to compare.`
          : (current?.precipitation ?? 0) > 0.5
            ? `Precipitation is active here right now, so cloud, wind, satellite texture and nearby hazard signals become the most interesting comparison.`
            : weather?.elevation != null && weather.elevation > 1500
              ? `This is high terrain at roughly ${Math.round(weather.elevation)} m; sunlight, cloud shadows, thin air and satellite texture make the landscape itself the signal.`
              : current?.is_day === 0
                ? `It is night here right now; darkness, aircraft motion, cloud cover and the nearest sky or city cameras become the strongest live evidence.`
                : nearestCamera
                  ? `The clearest visual way into this place is the nearest curated public look-in around ${nearestCamera.place}, while local weather, daylight, seismicity and aircraft motion supply the surrounding evidence.`
                  : 'This point is quiet in the public alert feeds, so Elsewhere reads weather, daylight, terrain, seismicity and human motion to reveal what is distinctive without inventing an event.';
  const imagery = earthImagery(lat, lon);
  const notable = (wiki?.query?.geosearch ?? []).filter((n: any) => n?.title && !/^(canton|arrondissement|province|prefecture|county|district|municipality|department|oblast|region|state of)/i.test(n.title) && !/\((department|province|county|district|municipality|state|region|oblast|prefecture)\)/i.test(n.title));
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
    nearestCamera ? { label: 'Nearest live look-in', value: `${nearestCamera.place} · ${Math.round(nearestCamera.distance)} km away`, kind: 'verified' } : null,
    notable.length ? { label: 'Notable nearby', value: notable.slice(0, 2).map((n: any) => `${n.title}${n.dist ? ` · ${n.dist < 1000 ? Math.round(n.dist) + ' m' : (n.dist / 1000).toFixed(1) + ' km'}` : ''}`).join(' — '), kind: 'verified' } : null,
    { label: 'Satellite context', value: imagery.nearRealtime ? 'GOES GeoColor sector image, usually minutes old' : 'Latest daylight swath; orbital gaps possible', kind: 'observed' },
    { label: 'Attribution', value: 'Weather is model/grid data; reverse geocoding is approximate; populated places may be coarse', kind: 'question' }
  ].filter(Boolean);
  return NextResponse.json({
    place: {
      lat, lon, label: placeName,
      locality: address.city ?? address.town ?? address.village ?? place?.name, country: address.country,
      timezone: weather?.timezone,
      mediaImage: imagery.url,
      mediaAlt: Math.abs(lat) > 71 && !imagery.nearRealtime ? imagery.altPrefix : `${imagery.altPrefix} around ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
      facts,
      sources: [
        { label: imagery.sourceLabel, url: imagery.nearRealtime ? 'https://www.star.nesdis.noaa.gov/GOES/' : 'https://worldview.earthdata.nasa.gov/', retrievedAt: new Date().toISOString() },
        { label: 'Open-Meteo current weather', url: 'https://open-meteo.com/', retrievedAt: new Date().toISOString() },
        { label: 'OpenStreetMap Nominatim reverse geocode', url: 'https://nominatim.openstreetmap.org/', retrievedAt: new Date().toISOString() },
        { label: 'USGS 24-hour earthquake feed', url: 'https://earthquake.usgs.gov/earthquakes/feed/', retrievedAt: new Date().toISOString() },
        { label: 'GDACS current disaster alerts', url: 'https://www.gdacs.org/', retrievedAt: new Date().toISOString() },
        { label: 'adsb.lol live aircraft transponders', url: 'https://adsb.lol/', retrievedAt: new Date().toISOString() }
      ],
      hook,
      retrievedAt: new Date().toISOString()
    }
  });
}
