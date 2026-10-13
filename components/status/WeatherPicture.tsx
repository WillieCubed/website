import type { PublicStatus } from '@/lib/status/types';

export function weatherLabel(weather: PublicStatus['weather']) {
  if (!weather) return 'Weather unavailable';
  const code = weather.code;
  if (code <= 1) return code === 0 ? 'Clear skies' : 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 95) return 'Thunderstorms';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snowy';
  return 'Rainy';
}

export default function WeatherPicture({
  weather,
}: {
  weather: PublicStatus['weather'];
}) {
  const clear = weather && weather.code <= 1;
  const night = weather && !weather.isDay;
  const overcast = !weather || [3, 45, 48].includes(weather.code);
  return (
    <span className="weather-picture" aria-hidden="true">
      <svg className="sky-glyph" viewBox="0 0 180 144" fill="none">
        {!overcast &&
          (night ? (
            <path
              d="M83 18a34 34 0 1 0 34 43A31 31 0 0 1 83 18"
              fill="var(--sky-moon)"
            />
          ) : (
            <g>
              <g stroke="var(--sky-ray)" strokeWidth="5" strokeLinecap="round">
                <path d="M72 17v-8m0 94v-8M29 52h-8m94 0h8M41 21l-6-6m74 74 6 6M41 83l-6 6m74-74 6-6" />
              </g>
              <circle cx="72" cy="52" r="29" fill="var(--sky-sun)" />
            </g>
          ))}
        {!clear && (
          <>
            <path
              d="M44 113C25 113 17 104 17 92c0-12 9-21 21-22 0-18 14-33 32-33 14 0 26 8 31 20 4-2 9-3 14-3 16 0 29 13 29 29 11 2 18 9 18 17 0 9-7 13-20 13Z"
              fill="var(--sky-cloud)"
            />
            <path
              d="M44 113h98c13 0 20-4 20-13"
              stroke="var(--sky-cloud-shade)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        )}
        <g
          transform={
            clear
              ? night
                ? 'translate(64.5 51)'
                : 'translate(64.5 48)'
              : 'translate(82 86)'
          }
        >
          <circle r="2.2" fill="var(--sky-face)" />
          <circle cx="15" r="2.2" fill="var(--sky-face)" />
          <path
            d="M5 7q3 3 6 0"
            stroke="var(--sky-face)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
        {weather && weather.code >= 51 && (
          <g stroke="var(--sky-rain)" strokeWidth="4" strokeLinecap="round">
            <path d="m59 125-3 8m30-8-3 8m30-8-3 8" />
          </g>
        )}
      </svg>
    </span>
  );
}
