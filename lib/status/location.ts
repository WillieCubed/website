import { z } from 'zod';

export const citySchema = z.object({
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120),
  country: z.string().trim().min(1).max(120),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Choose a valid IANA timezone.'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type City = z.infer<typeof citySchema>;
export type LocationSnapshot = {
  source: 'default' | 'manual';
  location: City;
  updatedAt: string | null;
};

export interface PublicLocation {
  city: string;
  region: string;
  country: string;
  timezone: string;
  updatedAt: string | null;
}

export const defaultLocation: LocationSnapshot = {
  source: 'default',
  updatedAt: null,
  location: {
    city: 'Las Vegas',
    region: 'Nevada',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    latitude: 36.17,
    longitude: -115.14,
  },
};

// Future beacon adapters return a city snapshot, never a device position.
export interface LocationSource {
  read(): Promise<LocationSnapshot | null>;
}
export async function resolveLocation(
  source: LocationSource
): Promise<LocationSnapshot> {
  return (await source.read()) ?? defaultLocation;
}
export function publicLocation(snapshot: LocationSnapshot): PublicLocation {
  const { city, region, country, timezone } = snapshot.location;
  return { city, region, country, timezone, updatedAt: snapshot.updatedAt };
}

export async function searchCities(
  query: string,
  fetcher: typeof fetch = fetch
): Promise<City[]> {
  if (query.trim().length < 2 || query.length > 100) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({
    name: query.trim(),
    count: '6',
    language: 'en',
    format: 'json',
  }).toString();
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('City search unavailable');
  const data = await response.json();
  return (Array.isArray(data.results) ? data.results : []).flatMap(
    (row: Record<string, unknown>) => {
      const parsed = citySchema.safeParse({
        city: row.name,
        region: row.admin1 ?? '',
        country: row.country,
        timezone: row.timezone,
        latitude: row.latitude,
        longitude: row.longitude,
      });
      return parsed.success ? [parsed.data] : [];
    }
  );
}
