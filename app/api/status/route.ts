import { cacheLife } from 'next/cache';
import { connection } from 'next/server';

import { parseWeather, statusLocation } from '@/lib/status/model';

async function loadWeather() {
  'use cache';
  cacheLife({ stale: 300, revalidate: 900, expire: 1800 });
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(statusLocation.latitude),
    longitude: String(statusLocation.longitude),
    current: 'temperature_2m,weather_code,is_day',
    temperature_unit: 'fahrenheit',
    timezone: 'UTC',
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('Weather source unavailable');
  const weather = parseWeather(await response.json());
  if (!weather) throw new Error('Weather source returned invalid conditions');
  return weather;
}

export async function GET() {
  await connection();
  try {
    return Response.json(
      { weather: await loadWeather() },
      {
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=900' },
      }
    );
  } catch {
    return Response.json(
      { weather: null },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
