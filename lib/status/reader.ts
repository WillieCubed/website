import { cacheLife, cacheTag } from 'next/cache';

import { defaultLocation, publicLocation, resolveLocation } from './location';
import { statusStore } from './storage';

export const STATUS_LOCATION_TAG = 'status-location';
export async function readLocation() {
  'use cache';
  cacheLife({ stale: 0, revalidate: 10800, expire: 21600 });
  cacheTag(STATUS_LOCATION_TAG);
  if (!process.env.POSTGRES_URL) return defaultLocation;
  return resolveLocation(statusStore);
}
export async function readPublicStatus() {
  const snapshot = await readLocation();
  const { latitude, longitude } = snapshot.location;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code,is_day',
    temperature_unit: 'fahrenheit',
    timezone: 'UTC',
  }).toString();
  let weather = null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 900 },
    });
    if (response.ok) {
      const data = await response.json();
      const current = data.current;
      if (
        current &&
        Number.isFinite(current.temperature_2m) &&
        Number.isInteger(current.weather_code) &&
        typeof current.time === 'string'
      ) {
        const observed = new Date(`${current.time}Z`);
        if (Math.abs(Date.now() - observed.getTime()) < 3600000)
          weather = {
            temperature: current.temperature_2m,
            unit: 'F',
            code: current.weather_code,
            isDay: current.is_day === 1,
            observedAt: observed.toISOString(),
          };
      }
    }
  } catch {
    /* Location remains useful when the weather provider is unavailable. */
  }
  return { location: publicLocation(snapshot), weather };
}
