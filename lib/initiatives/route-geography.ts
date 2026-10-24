import type { Place } from './index';
import outlines from './world-outlines.json';

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 440;
const PAD = 32;

export function isHawaii(place: Place) {
  return (
    place.lng > -161 && place.lng < -154 && place.lat > 18 && place.lat < 23
  );
}

/** Keep longitude and latitude on one scale so nearby towns do not fill a continent. */
export function geographicView(places: Place[], mainland: boolean) {
  const lngs = places.map((place) => place.lng);
  const lats = places.map((place) => place.lat);
  const west = mainland ? -126 : Math.min(...lngs) - 2;
  const east = mainland ? -66 : Math.max(...lngs) + 2;
  const south = mainland ? 24 : Math.min(...lats) - 2;
  const north = mainland ? 50 : Math.max(...lats) + 2;
  const latitudeScale = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = Math.min(
    (MAP_WIDTH - PAD * 2) / ((east - west) * latitudeScale),
    (MAP_HEIGHT - PAD * 2) / (north - south)
  );
  const centerLng = (west + east) / 2;
  const centerLat = (south + north) / 2;
  const project = (lng: number, lat: number) => [
    +(MAP_WIDTH / 2 + (lng - centerLng) * latitudeScale * scale).toFixed(1),
    +(MAP_HEIGHT / 2 - (lat - centerLat) * scale).toFixed(1),
  ];
  const land = outlines
    .filter((ring) => {
      const longitudes = ring.map(([lng]) => lng);
      const latitudes = ring.map(([, lat]) => lat);
      return (
        Math.min(...longitudes) <= east &&
        Math.max(...longitudes) >= west &&
        Math.min(...latitudes) <= north &&
        Math.max(...latitudes) >= south
      );
    })
    .map((ring) => `${linePath(ring.map(([lng, lat]) => project(lng, lat)))}Z`);
  return { project, land };
}

export function linePath(points: number[][]) {
  return points
    .map(([x, y], index) => `${index > 0 ? 'L' : 'M'}${x} ${y}`)
    .join(' ');
}
