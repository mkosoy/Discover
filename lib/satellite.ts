export function worldviewSnapshot(lat: number, lon: number, latSpan = 8, lonSpan = 12) {
  const centerLon = Math.max(-180 + lonSpan / 2, Math.min(180 - lonSpan / 2, lon));
  const latMin = Math.max(-75, lat - latSpan / 2);
  const latMax = Math.min(75, lat + latSpan / 2);
  const lonMin = centerLon - lonSpan / 2;
  const lonMax = centerLon + lonSpan / 2;
  return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&BBOX=${latMin.toFixed(2)}%2C${lonMin.toFixed(2)}%2C${latMax.toFixed(2)}%2C${lonMax.toFixed(2)}&CRS=EPSG%3A4326&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&FORMAT=image%2Fjpeg&WIDTH=900&HEIGHT=520`;
}
