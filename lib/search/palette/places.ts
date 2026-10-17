import { fetchWithDeadline } from '@/lib/http/fetch';

import type { PaletteData } from './types';

/** What the palette offers before its places arrive, or if they never do. */
export const NO_PLACES: PaletteData = {
  writings: [],
  initiatives: [],
  ventures: [],
};

let placesRequest: Promise<PaletteData> | null = null;

/**
 * The palette's places, fetched once per page load on first open
 * through the palette endpoint. A failed request is forgotten so the next opening can
 * try again, and the palette still searches and runs its commands meanwhile.
 */
export function loadPlaces(): Promise<PaletteData> {
  placesRequest ??= fetchWithDeadline('/api/palette')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<PaletteData>;
    })
    .catch((error: unknown) => {
      placesRequest = null;
      throw error;
    });
  return placesRequest;
}
