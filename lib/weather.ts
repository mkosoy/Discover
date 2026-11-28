// Shared weather access with provider fallback. Open-Meteo's keyless tier has
// a daily quota that can bind; met.no (Norwegian Meteorological Institute) is
// keyless with a User-Agent requirement. Both are normalized to one shape.

export type NormalizedCurrent = {
  temperature_2m?: number;
  apparent_temperature?: number;
  precipitation?: number;
  cloud_cover?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  is_day?: number;
  provider: 'open-meteo' | 'met.no';
};

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 5000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, ...init, next: { revalidate: 300 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return data;
  } catch { return null; }
}

// WMO weather-code approximation from met.no symbol strings.
function metnoSymbolToCode(symbol?: string): number | undefined {
  if (!symbol) return undefined;
  if (symbol.includes('thunder')) return 95;
  if (symbol.includes('heavyrain') || symbol.includes('heavyshowers')) return 65;
  if (symbol.includes('rain') || symbol.includes('showers')) return 61;
  if (symbol.includes('sleet')) return 67;
  if (symbol.includes('snow')) return 73;
  if (symbol.includes('fog')) return 45;
  if (symbol.includes('cloudy') && !symbol.includes('partly') && !symbol.includes('fair')) return 3;
  if (symbol.includes('partlycloudy') || symbol.includes('fair')) return 2;
  if (symbol.includes('clearsky')) return 0;
  return undefined;
}

export async function currentWeather(lat: number, lon: number): Promise<{ current: NormalizedCurrent; timezone?: string; daily?: any; elevation?: number } | null> {
  const om = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,cloud_cover,weather_code,wind_speed_10m,wind_direction_10m,is_day&daily=sunrise,sunset&timezone=auto`);
  if (om?.current) return { current: { ...om.current, provider: 'open-meteo' }, timezone: om.timezone, daily: om.daily, elevation: om.elevation };
  const mn = await fetchJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, { headers: { 'User-Agent': 'Elsewhere earth discovery (https://github.com/mkosoy/Discover)' } });
  const step = mn?.properties?.timeseries?.[0]?.data;
  if (!step?.instant?.details) return null;
  const d = step.instant.details;
  return {
    current: {
      temperature_2m: d.air_temperature,
      precipitation: step.next_1_hours?.details?.precipitation_amount,
      cloud_cover: d.cloud_area_fraction,
      weather_code: metnoSymbolToCode(step.next_1_hours?.summary?.symbol_code),
      wind_speed_10m: d.wind_speed != null ? d.wind_speed * 3.6 : undefined, // m/s → km/h to match Open-Meteo units
      wind_direction_10m: d.wind_from_direction,
      provider: 'met.no'
    },
    timezone: undefined
  };
}

// Batched variant: try one Open-Meteo multi-location request first (cheap on
// quota), fall back to parallel met.no per-point requests when the quota is
// exhausted or the provider errors. Rows align with the input order.
export async function currentWeatherBatch(points: Array<[number, number]>, fields = 'temperature_2m,wind_speed_10m,wind_gusts_10m,is_day,cloud_cover'): Promise<Array<any | null>> {
  const lats = points.map(p => p[0]).join(',');
  const lons = points.map(p => p[1]).join(',');
  const om = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=${fields}&timezone=auto`, undefined, 8000);
  const rows: any[] = Array.isArray(om) ? om : om ? [om] : [];
  if (rows.length === points.length && rows.some(r => r?.current)) {
    return points.map((_, i) => rows[i]?.current ? rows[i] : null);
  }
  const out: Array<any | null> = [];
  const chunk = 6;
  for (let i = 0; i < points.length; i += chunk) {
    const slice = await Promise.all(points.slice(i, i + chunk).map(async ([lat, lon]) => {
      const mn = await fetchJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, { headers: { 'User-Agent': 'Elsewhere earth discovery (https://github.com/mkosoy/Discover)' } }, 7000);
      const step = mn?.properties?.timeseries?.[0]?.data;
      if (!step?.instant?.details) return null;
      const d = step.instant.details;
      return {
        current: {
          temperature_2m: d.air_temperature,
          wind_speed_10m: d.wind_speed != null ? d.wind_speed * 3.6 : undefined,
          wind_gusts_10m: d.wind_gust != null ? d.wind_gust * 3.6 : undefined,
          cloud_cover: d.cloud_area_fraction,
          pressure_msl: d.air_pressure_at_sea_level,
          is_day: undefined,
          provider: 'met.no'
        }
      };
    }));
    out.push(...slice);
  }
  return out;
}

// NOAA solar-position approximation — shared so any card can resolve daylight
// without depending on a weather provider's is_day flag.
export function solarElevationDeg(lat: number, lon: number, date = new Date()) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = Math.floor((date.getTime() - start) / 86400000);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const gamma = 2 * Math.PI / 365 * (doy - 1 + (utcHours - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const tst = (utcHours * 60 + eqtime + 4 * lon) % 1440;
  const ha = (tst / 4 - 180) * rad;
  return Math.asin(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha)) / rad;
}

export function isDaylightNow(lat: number, lon: number, providerIsDay?: number) {
  if (providerIsDay != null) return providerIsDay === 1;
  return solarElevationDeg(lat, lon) > -1;
}
