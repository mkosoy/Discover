import { NextResponse } from 'next/server';

async function json<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 120 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 });
  const [weather, place, air] = await Promise.all([
    json<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,cloud_cover,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`),
    json<any>(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`),
    json<any>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,ozone&timezone=auto`)
  ]);
  const current = weather?.current;
  const placeName = [place?.locality, place?.principalSubdivision, place?.countryName].filter(Boolean).join(', ') || place?.countryName || (Math.abs(lat) > 66 ? 'Polar region' : 'Open ocean / unpopulated area');
  const facts = [
    current ? { label: 'Weather', value: `${weatherText(current.weather_code)}, ${Math.round(current.temperature_2m)}°C`, kind: 'observed' } : { label: 'Weather', value: 'Unavailable', kind: 'question' },
    current ? { label: 'Wind', value: `${Math.round(current.wind_speed_10m)} km/h from ${Math.round(current.wind_direction_10m)}°`, kind: 'observed' } : null,
    current ? { label: 'Cloud cover', value: `${Math.round(current.cloud_cover)}%`, kind: 'observed' } : null,
    air?.current?.pm2_5 != null ? { label: 'PM2.5', value: `${Math.round(air.current.pm2_5)} μg/m³ model`, kind: 'interpretation' } : null,
    weather?.elevation != null ? { label: 'Elevation', value: `${Math.round(weather.elevation)} m`, kind: 'verified' } : null,
    weather?.timezone ? { label: 'Local timezone', value: weather.timezone.replace('_', ' '), kind: 'verified' } : null,
    { label: 'Attribution', value: 'Weather is model/grid data; reverse geocoding is approximate', kind: 'question' }
  ].filter(Boolean);
  return NextResponse.json({
    place: {
      lat, lon, label: placeName,
      locality: place?.locality, country: place?.countryName,
      timezone: weather?.timezone,
      facts,
      retrievedAt: new Date().toISOString()
    }
  });
}
