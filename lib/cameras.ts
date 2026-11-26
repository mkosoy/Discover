export type PublicCamera = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  youtubeId: string;
  place: string;
  kind: 'city' | 'nature' | 'volcano' | 'aurora' | 'wildlife' | 'water';
  quality: number;
};

export const publicCameras: PublicCamera[] = [
  { id: 'times-square', title: 'Times Square North 4K', lat: 40.758, lon: -73.9855, youtubeId: 'ZxCeWQ3Lcig', place: 'New York City', kind: 'city', quality: 94 },
  { id: 'times-square-broadway', title: 'Times Square 1560 Broadway', lat: 40.7585, lon: -73.985, youtubeId: 'VXo0VqVcbK4', place: 'New York City', kind: 'city', quality: 88 },
  { id: 'world-trade-center', title: 'World Trade Center', lat: 40.7127, lon: -74.0134, youtubeId: '5C9oM7C2Q9k', place: 'New York City', kind: 'city', quality: 90 },
  { id: 'abbey-road', title: 'Abbey Road Crossing', lat: 51.5321, lon: -0.1776, youtubeId: 'zMCea32gpmg', place: 'London', kind: 'city', quality: 91 },
  { id: 'london-bridge', title: 'London Bridge and River Thames', lat: 51.5079, lon: -0.0877, youtubeId: 'MXmzsjABC-U', place: 'London', kind: 'city', quality: 89 },
  { id: 'venice-guglie', title: 'Ponte delle Guglie canal view', lat: 45.443, lon: 12.323, youtubeId: 'mt7uE-n0YPI', place: 'Venice', kind: 'water', quality: 90 },
  { id: 'venice-rolling', title: 'Rolling Venice live camera', lat: 45.4408, lon: 12.3155, youtubeId: 'a1mcaV3Sf9U', place: 'Venice', kind: 'water', quality: 84 },
  { id: 'niagara-falls', title: 'Niagara Falls', lat: 43.082, lon: -79.075, youtubeId: 'qx7gry390YA', place: 'Niagara Falls', kind: 'nature', quality: 93 },
  { id: 'mount-fuji-shizuoka', title: 'Mount Fuji from Shizuoka', lat: 35.16, lon: 138.68, youtubeId: 'XqQ9RUU3jQs', place: 'Mount Fuji', kind: 'nature', quality: 90 },
  { id: 'mount-fuji-kawaguchi', title: 'Mount Fuji from Lake Kawaguchi', lat: 35.52, lon: 138.75, youtubeId: 'bdUbACCWmoY', place: 'Mount Fuji', kind: 'nature', quality: 89 },
  { id: 'ol-donyo-wildlife', title: 'ol Donyo Lodge wildlife waterhole', lat: -2.72, lon: 37.32, youtubeId: 'XsOU8JnEpNM', place: 'Kenya', kind: 'wildlife', quality: 94 },
  { id: 'etosha-waterhole', title: 'Okaukuejo wildlife waterhole', lat: -19.18, lon: 15.91, youtubeId: 'JMMoRwYo5kE', place: 'Etosha, Namibia', kind: 'wildlife', quality: 92 },
  { id: 'wild-africa', title: 'Wild Africa safari camera', lat: -24.7, lon: 31.5, youtubeId: 'qpukdDslCjk', place: 'Southern Africa', kind: 'wildlife', quality: 88 },
  { id: 'utsjoki-aurora', title: 'Utsjoki northern lights sky camera', lat: 69.9, lon: 27.0, youtubeId: 'Iw5VhekzbxE', place: 'Utsjoki, Finland', kind: 'aurora', quality: 89 },
  { id: 'greenland-aurora', title: 'Greenland northern lights sky camera', lat: 64.18, lon: -51.72, youtubeId: '0dmg4CsvcAQ', place: 'Greenland', kind: 'aurora', quality: 82 },
  { id: 'namib-desert', title: 'Namib Desert landscape camera', lat: -23.65, lon: 15.95, youtubeId: 'ydYDqZQpim8', place: 'Namib Desert', kind: 'nature', quality: 90 },
  { id: 'mount-etna', title: 'Mount Etna volcano camera', lat: 37.73, lon: 15.0, youtubeId: 'JmKT_-IAUPc', place: 'Mount Etna', kind: 'volcano', quality: 95 },
  { id: 'washington-monument', title: 'Washington Monument and National Mall', lat: 38.8894, lon: -77.0352, youtubeId: 'mG2gAWY_Guw', place: 'Washington, D.C.', kind: 'city', quality: 94 },
  { id: 'hollywood-beach', title: 'Hollywood Beach Broadwalk', lat: 26.011, lon: -80.113, youtubeId: 'cmkAbDUEoyA', place: 'Hollywood Beach, Florida', kind: 'water', quality: 89 },
  { id: 'sunny-isles', title: 'Sunny Isles Beach', lat: 25.94, lon: -80.12, youtubeId: 'H91O7OQudcc', place: 'Miami coast', kind: 'water', quality: 86 },
  { id: 'venice-beach-la', title: 'Venice Beach oceanfront', lat: 33.985, lon: -118.469, youtubeId: 'EO_1LWqsCNE', place: 'Los Angeles', kind: 'water', quality: 90 },
  { id: 'boston-common', title: 'Boston Common skyline', lat: 42.355, lon: -71.065, youtubeId: 'wPCrbAjyl6U', place: 'Boston', kind: 'city', quality: 88 },
  { id: 'chicago-loop', title: 'Downtown Chicago city view', lat: 41.878, lon: -87.63, youtubeId: 'KTJ8Hj_tmk4', place: 'Chicago', kind: 'city', quality: 86 },
  { id: 'new-orleans-street', title: 'New Orleans street view', lat: 29.958, lon: -90.065, youtubeId: 'xqdukYhcGEU', place: 'New Orleans', kind: 'city', quality: 89 },
  { id: 'toronto-harbour', title: 'Toronto skyline and Lake Ontario', lat: 43.64, lon: -79.38, youtubeId: 'bbjwotvAvDM', place: 'Toronto', kind: 'city', quality: 88 },
  { id: 'vancouver-harbour', title: 'Vancouver harbour and Canada Place', lat: 49.288, lon: -123.111, youtubeId: 'rxyNjFKwzJA', place: 'Vancouver', kind: 'water', quality: 90 },
  { id: 'banff-town', title: 'Banff mountain town', lat: 51.178, lon: -115.571, youtubeId: 'Axw2qu_KmWA', place: 'Banff, Alberta', kind: 'nature', quality: 86 },
  { id: 'kilauea-crater', title: 'Kīlauea west Halemaʻumaʻu crater', lat: 19.407, lon: -155.283, youtubeId: 'HggWKlZv9yk', place: 'Hawaiʻi Volcanoes National Park', kind: 'volcano', quality: 96 },
  { id: 'maui-napili', title: 'Napili Bay beach', lat: 20.994, lon: -156.667, youtubeId: 'fwX04Gsb8W4', place: 'Maui, Hawaiʻi', kind: 'water', quality: 87 },
  { id: 'amsterdam-dam', title: 'Dam Square ultra-HD camera', lat: 52.373, lon: 4.893, youtubeId: 'Gd9d4q6WvUY', place: 'Amsterdam', kind: 'city', quality: 90 },
  { id: 'grimentz-alps', title: 'Grimentz alpine view', lat: 46.18, lon: 7.58, youtubeId: 'iCxfe27HpaY', place: 'Swiss Alps', kind: 'nature', quality: 87 },
  { id: 'geiranger-fjord', title: 'Geiranger fjord', lat: 62.1, lon: 7.2, youtubeId: 'wAdTV6Uc5eA', place: 'Geiranger, Norway', kind: 'nature', quality: 90 },
  { id: 'iceland-volcano-watch', title: 'Iceland volcano watch multicam', lat: 63.85, lon: -22.7, youtubeId: 'qkSvU9j4kqM', place: 'Reykjanes, Iceland', kind: 'volcano', quality: 93 },
  { id: 'reykjavik-perlan', title: 'Reykjavík from Perlan', lat: 64.129, lon: -21.919, youtubeId: 'WuBmLBuvKYA', place: 'Reykjavík, Iceland', kind: 'city', quality: 88 },
  { id: 'seoul-han-river', title: 'Seoul Han River skyline', lat: 37.52, lon: 126.97, youtubeId: 'vk5BHoDxXf0', place: 'Seoul', kind: 'city', quality: 90 },
  { id: 'bangkok-sukhumvit', title: 'Bangkok Sukhumvit street camera', lat: 13.74, lon: 100.55, youtubeId: 'UemFRPrl1hk', place: 'Bangkok', kind: 'city', quality: 85 },
  { id: 'hong-kong-harbour', title: 'Hong Kong Tsim Sha Tsui harbour view', lat: 22.293, lon: 114.169, youtubeId: 'Z8NTLkEFZjg', place: 'Hong Kong', kind: 'city', quality: 87 },
  { id: 'singapore-downtown', title: 'Downtown Singapore camera', lat: 1.29, lon: 103.85, youtubeId: 'rQ3VvxadJeo', place: 'Singapore', kind: 'city', quality: 89 },
  { id: 'singapore-port', title: 'Singapore port shipping camera', lat: 1.265, lon: 103.82, youtubeId: 'JE5E5p8ACCQ', place: 'Singapore port', kind: 'water', quality: 87 },
  { id: 'table-mountain', title: 'Table Mountain and Cape Town', lat: -33.96, lon: 18.40, youtubeId: 'jOqASqt3vVI', place: 'Cape Town', kind: 'nature', quality: 91 },
  { id: 'copacabana-rio', title: 'Copacabana beach panorama', lat: -22.97, lon: -43.18, youtubeId: 'Bz9Hkrk1NcY', place: 'Rio de Janeiro', kind: 'water', quality: 90 },
  { id: 'sydney-harbour', title: 'Sydney Harbour and Opera House', lat: -33.856, lon: 151.215, youtubeId: '6FLSjlQhiKo', place: 'Sydney', kind: 'water', quality: 92 },
  { id: 'auckland-viaduct', title: 'Auckland Viaduct Harbour', lat: -36.842, lon: 174.763, youtubeId: 'nLCMw_Fh0u0', place: 'Auckland', kind: 'water', quality: 90 },
  { id: 'dubai-skyline', title: 'Dubai skyline camera', lat: 25.2, lon: 55.27, youtubeId: 'ka9MsehA8I4', place: 'Dubai', kind: 'city', quality: 85 },
  { id: 'shibuya-crossing', title: 'Shibuya crossing atmosphere', lat: 35.68, lon: 139.69, youtubeId: '5B4LmH4JbnY', place: 'Tokyo', kind: 'city', quality: 91 }
];

export function cameraDistanceKm(latA: number, lonA: number, latB: number, lonB: number) {
  const rad = Math.PI / 180;
  const dLat = (latB - latA) * rad;
  const dLon = (lonB - lonA) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearestPublicCameras(lat: number, lon: number, limit = 3) {
  return publicCameras
    .map(camera => ({ ...camera, distance: cameraDistanceKm(lat, lon, camera.lat, camera.lon) }))
    .sort((a, b) => a.distance - b.distance || b.quality - a.quality)
    .slice(0, limit);
}

export function cameraEmbed(camera: Pick<PublicCamera, 'youtubeId'>) {
  return `https://www.youtube.com/embed/${camera.youtubeId}?rel=0&autoplay=1&mute=1&playsinline=1`;
}
