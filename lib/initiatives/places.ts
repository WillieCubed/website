import type { Place } from './schema';

export function uniquePlaces(places: Place[]) {
  const unique = new Map<string, Place>();
  for (const place of places) {
    if (!unique.has(place.name)) unique.set(place.name, place);
  }
  return [...unique.values()];
}

export function repeatedPlaceNames(places: Place[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const place of places) {
    if (seen.has(place.name)) repeated.add(place.name);
    seen.add(place.name);
  }
  return repeated;
}
