export function worldviewSnapshot(lat: number, lon: number, latSpan = 8, lonSpan = 12) {
  const centerLon = Math.max(-180 + lonSpan / 2, Math.min(180 - lonSpan / 2, lon));
  // Clamp the center so the span always fits inside the service's ±75° coverage —
  // otherwise polar requests produce a zero-height or inverted bbox.
  const clampedLat = Math.max(-75 + latSpan / 2, Math.min(75 - latSpan / 2, lat));
  const latMin = clampedLat - latSpan / 2;
  const latMax = clampedLat + latSpan / 2;
  const lonMin = centerLon - lonSpan / 2;
  const lonMax = centerLon + lonSpan / 2;
  return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&BBOX=${latMin.toFixed(2)}%2C${lonMin.toFixed(2)}%2C${latMax.toFixed(2)}%2C${lonMax.toFixed(2)}&CRS=EPSG%3A4326&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&FORMAT=image%2Fjpeg&WIDTH=900&HEIGHT=520`;
}

export function nightLightsSnapshot(lat: number, lon: number, latSpan = 8, lonSpan = 12) {
  const centerLon = Math.max(-180 + lonSpan / 2, Math.min(180 - lonSpan / 2, lon));
  // City lights is a static global composite (unlike MODIS daytime swaths), so
  // polar locations are valid — clamp only to what EPSG:4326 can express.
  const clampedLat = Math.max(-85 + latSpan / 2, Math.min(85 - latSpan / 2, lat));
  const latMin = clampedLat - latSpan / 2;
  const latMax = clampedLat + latSpan / 2;
  const lonMin = centerLon - lonSpan / 2;
  const lonMax = centerLon + lonSpan / 2;
  return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&BBOX=${latMin.toFixed(2)}%2C${lonMin.toFixed(2)}%2C${latMax.toFixed(2)}%2C${lonMax.toFixed(2)}&CRS=EPSG%3A4326&LAYERS=VIIRS_CityLights_2012&FORMAT=image%2Fjpeg&WIDTH=900&HEIGHT=520`;
}

type EarthImagery = {
  url: string;
  sourceLabel: string;
  altPrefix: string;
  nearRealtime: boolean;
};

function inBox(lat: number, lon: number, latMin: number, latMax: number, lonMin: number, lonMax: number) {
  return lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;
}

export function earthImagery(lat: number, lon: number): EarthImagery {
  const sectors: { latMin: number; latMax: number; lonMin: number; lonMax: number; satellite: string; sector: string; label: string }[] = [
    { latMin: 35, latMax: 49, lonMin: -86, lonMax: -65, satellite: 'GOES19', sector: 'ne', label: 'NOAA GOES-East Northeast GeoColor sector imagery' },
    { latMin: 23, latMax: 38, lonMin: -94, lonMax: -74, satellite: 'GOES19', sector: 'se', label: 'NOAA GOES-East Southeast GeoColor sector imagery' },
    { latMin: 38, latMax: 50, lonMin: -96, lonMax: -75, satellite: 'GOES19', sector: 'cgl', label: 'NOAA GOES-East Great Lakes GeoColor sector imagery' },
    { latMin: 35, latMax: 49, lonMin: -101, lonMax: -85, satellite: 'GOES19', sector: 'umv', label: 'NOAA GOES-East Upper Mississippi Valley GeoColor sector imagery' },
    { latMin: 40, latMax: 53, lonMin: -117, lonMax: -100, satellite: 'GOES19', sector: 'nr', label: 'NOAA GOES-East Northern Rockies GeoColor sector imagery' },
    { latMin: 30, latMax: 43, lonMin: -117, lonMax: -100, satellite: 'GOES19', sector: 'sr', label: 'NOAA GOES-East Southern Rockies GeoColor sector imagery' },
    { latMin: 15, latMax: 24, lonMin: -70, lonMax: -60, satellite: 'GOES19', sector: 'pr', label: 'NOAA GOES-East Puerto Rico and Caribbean GeoColor sector imagery' },
    { latMin: 40, latMax: 55, lonMin: -132, lonMax: -110, satellite: 'GOES18', sector: 'pnw', label: 'NOAA GOES-West Pacific Northwest GeoColor sector imagery' },
    { latMin: 32, latMax: 42, lonMin: -127, lonMax: -113, satellite: 'GOES18', sector: 'psw', label: 'NOAA GOES-West Pacific Southwest GeoColor sector imagery' },
    { latMin: 50, latMax: 72, lonMin: -180, lonMax: -128, satellite: 'GOES18', sector: 'ak', label: 'NOAA GOES-West Alaska GeoColor sector imagery' },
    { latMin: 15, latMax: 30, lonMin: -170, lonMax: -150, satellite: 'GOES18', sector: 'hi', label: 'NOAA GOES-West Hawaii GeoColor sector imagery' }
  ];
  const sector = sectors.find(candidate => inBox(lat, lon, candidate.latMin, candidate.latMax, candidate.lonMin, candidate.lonMax));
  if (sector) return {
    url: `https://cdn.star.nesdis.noaa.gov/${sector.satellite}/ABI/SECTOR/${sector.sector}/GEOCOLOR/latest.jpg`,
    sourceLabel: sector.label,
    altPrefix: 'Latest NOAA GOES GeoColor sector image',
    nearRealtime: true
  };
  const polar = Math.abs(lat) > 71;
  return {
    url: worldviewSnapshot(lat, lon),
    sourceLabel: 'NASA MODIS latest available true-color satellite swath',
    altPrefix: polar
      ? 'NASA MODIS true-color swath of the nearest covered latitudes — polar regions are outside daily coverage'
      : 'NASA MODIS latest available true-color satellite swath',
    nearRealtime: false
  };
}
