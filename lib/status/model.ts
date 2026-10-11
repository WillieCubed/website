export const statusLocation = {
  city: 'Las Vegas',
  timeZone: 'America/Los_Angeles',
  latitude: 36.17,
  longitude: -115.14,
} as const;

export interface Weather {
  temperature: number;
  code: number;
  isDay: boolean;
  observedAt: string;
}

const CODES = new Set([
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77,
  80, 81, 82, 85, 86, 95, 96, 99,
]);

export function parseWeather(value: unknown): Weather | null {
  if (!value || typeof value !== 'object' || !('current' in value)) return null;
  const current = value.current;
  if (!current || typeof current !== 'object') return null;
  const {
    temperature_2m: temperature,
    weather_code: code,
    is_day: day,
    time,
  } = current as Record<string, unknown>;
  if (
    typeof temperature !== 'number' ||
    !Number.isFinite(temperature) ||
    typeof code !== 'number' ||
    !CODES.has(code) ||
    (day !== 0 && day !== 1) ||
    typeof time !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)
  )
    return null;
  // The provider is explicitly requested in UTC but omits the suffix.
  const timestamp = Date.parse(`${time}Z`);
  if (!Number.isFinite(timestamp)) return null;
  return {
    temperature: Math.round(temperature),
    code,
    isDay: day === 1,
    observedAt: new Date(timestamp).toISOString(),
  };
}

export function usableWeather(
  weather: Weather | null,
  now: number
): Weather | null {
  if (!weather) return null;
  const age = now - Date.parse(weather.observedAt);
  return Number.isFinite(age) && age >= -5 * 60_000 && age <= 60 * 60_000
    ? weather
    : null;
}

export function weatherCondition(
  code: number,
  day: boolean
): { label: string; icon: 'sun' | 'moon' | 'cloud' | 'rain' } {
  if (code === 0 || code === 1)
    return {
      label: code === 0 ? 'Clear skies' : 'Mostly clear',
      icon: day ? 'sun' : 'moon',
    };
  if (code === 2) return { label: 'Partly cloudy', icon: 'cloud' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Foggy', icon: 'cloud' };
  if (code >= 95) return { label: 'Thunderstorms', icon: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { label: 'Snow', icon: 'cloud' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rain' };
  return { label: 'Rain', icon: 'rain' };
}
