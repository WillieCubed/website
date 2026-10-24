import type { Place } from './index';
import outlines from './world-outlines.json';

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 440;
const PAD = 32;
export const HAWAII_INSET = { x: 16, y: 430, width: 192, height: 106 };

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

export function curvedLeg([x1, y1]: number[], [x2, y2]: number[]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  // Reversing travel keeps the same arc instead of flipping its bend.
  const direction = dx < 0 || (dx === 0 && dy < 0) ? -1 : 1;
  const bend =
    (Math.min(distance * 0.22, 64) * direction) /
    (distance === 0 ? 1 : distance);
  const cx = +((x1 + x2) / 2 + dy * bend).toFixed(1);
  const cy = +((y1 + y2) / 2 - dx * bend).toFixed(1);
  return `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
}

export function routeGeography(places: Place[]) {
  const islands = places.filter(isHawaii);
  const separateHawaii = islands.length > 0 && islands.length < places.length;
  const main = separateHawaii
    ? places.filter((place) => !isHawaii(place))
    : places;
  const mainland = main.every(
    (place) =>
      place.lng >= -126 &&
      place.lng <= -66 &&
      place.lat >= 24 &&
      place.lat <= 50
  );
  const geography = geographicView(main, mainland);
  const inset = separateHawaii ? geographicView(islands, false) : null;
  const project = (place: Place) => {
    if (!inset || !isHawaii(place))
      return geography.project(place.lng, place.lat);
    const [x, y] = inset.project(place.lng, place.lat);
    return [
      HAWAII_INSET.x + (x * HAWAII_INSET.width) / MAP_WIDTH,
      HAWAII_INSET.y + (y * HAWAII_INSET.height) / MAP_HEIGHT,
    ];
  };
  return {
    land: geography.land,
    project,
    islandLand: inset?.land ?? [],
    height: inset ? 560 : MAP_HEIGHT,
  };
}
