import Icon, { type IconName } from '@/components/icons/Icon';

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
  compact = false,
}: {
  compact?: boolean;
  weather: PublicStatus['weather'];
}) {
  if (compact) {
    if (!weather) return null;
    const label = weatherLabel(weather);
    const name: IconName =
      label === 'Clear skies' || label === 'Mostly clear'
        ? weather.isDay
          ? 'sun'
          : 'moon'
        : label === 'Partly cloudy'
          ? 'cloud-sun'
          : label === 'Foggy'
            ? 'fog'
            : label === 'Snowy'
              ? 'cloud-snow'
              : label === 'Thunderstorms'
                ? 'cloud-lightning'
                : label === 'Rainy'
                  ? 'cloud-rain'
                  : 'cloud';
    return (
      <span
        className="weather-picture weather-picture--compact"
        aria-hidden="true"
      >
        <Icon name={name} size={24} />
      </span>
    );
  }
  const clear = weather && weather.code <= 1;
  const night = weather && !weather.isDay;
  const overcast = !weather || [3, 45, 48].includes(weather.code);
  return (
    <span className="weather-picture" aria-hidden="true">
      <svg className="sky-glyph" viewBox="0 0 100 100" fill="none">
        <polygon
          points="99.8,50 99.4,52.59 98.28,55.07 96.59,57.38 94.61,59.48 92.6,61.41 90.82,63.26 89.47,65.15 88.63,67.2 88.25,69.49 88.19,72.05 88.25,74.84 88.16,77.73 87.72,80.55 86.76,83.1 85.21,85.21 83.1,86.76 80.55,87.72 77.73,88.16 74.84,88.25 72.05,88.19 69.49,88.25 67.2,88.63 65.15,89.47 63.26,90.82 61.41,92.6 59.48,94.61 57.38,96.59 55.07,98.28 52.59,99.4 50,99.8 47.41,99.4 44.93,98.28 42.62,96.59 40.52,94.61 38.59,92.6 36.74,90.82 34.85,89.47 32.8,88.63 30.51,88.25 27.95,88.19 25.16,88.25 22.27,88.16 19.45,87.72 16.9,86.76 14.79,85.21 13.24,83.1 12.28,80.55 11.84,77.73 11.75,74.84 11.81,72.05 11.75,69.49 11.37,67.2 10.53,65.15 9.18,63.26 7.4,61.41 5.39,59.48 3.41,57.38 1.72,55.07 0.6,52.59 0.2,50 0.6,47.41 1.72,44.93 3.41,42.62 5.39,40.52 7.4,38.59 9.18,36.74 10.53,34.85 11.37,32.8 11.75,30.51 11.81,27.95 11.75,25.16 11.84,22.27 12.28,19.45 13.24,16.9 14.79,14.79 16.9,13.24 19.45,12.28 22.27,11.84 25.16,11.75 27.95,11.81 30.51,11.75 32.8,11.37 34.85,10.53 36.74,9.18 38.59,7.4 40.52,5.39 42.62,3.41 44.93,1.72 47.41,0.6 50,0.2 52.59,0.6 55.07,1.72 57.38,3.41 59.48,5.39 61.41,7.4 63.26,9.18 65.15,10.53 67.2,11.37 69.49,11.75 72.05,11.81 74.84,11.75 77.73,11.84 80.55,12.28 83.1,13.24 85.21,14.79 86.76,16.9 87.72,19.45 88.16,22.27 88.25,25.16 88.19,27.95 88.25,30.51 88.63,32.8 89.47,34.85 90.82,36.74 92.6,38.59 94.61,40.52 96.59,42.62 98.28,44.93 99.4,47.41"
          fill="var(--sky-sun)"
        />
        <svg
          x="7"
          y="14"
          width="86"
          height="72"
          viewBox="0 0 180 144"
          fill="none"
        >
          {!overcast &&
            (night ? (
              <path
                d="M83 18a34 34 0 1 0 34 43A31 31 0 0 1 83 18"
                transform={clear ? 'translate(18 17.5)' : undefined}
                fill="var(--sky-moon)"
              />
            ) : (
              <g transform={clear ? 'translate(90 72)' : 'translate(72 52)'}>
                <g
                  stroke="var(--sky-ray)"
                  strokeWidth="5"
                  strokeLinecap="round"
                >
                  <path
                    d={
                      clear
                        ? 'M0 -43v-8M0 43v8M-43 0h-8M43 0h8M-30 -30l-6 -6M30 30l6 6M-30 30l-6 6M30 -30l6 -6'
                        : 'M0 -43v-8M-43 0h-8M43 0h8M-30 -30l-6 -6M30 -30l6 -6'
                    }
                  />
                </g>
                <circle r="29" fill="var(--sky-sun)" />
              </g>
            ))}
          {!clear && (
            <g transform="translate(0.5 -17.5)">
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
            </g>
          )}
          {/* The face bounds center is (7.5, 3.15); place it at the artwork's (90, 72) center. */}
          <g className="weather-face" transform="translate(82.5 68.85)">
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
            <g
              transform="translate(0.5 -17.5)"
              stroke="var(--sky-rain)"
              strokeWidth="4"
              strokeLinecap="round"
            >
              <path d="m59 125-3 8m30-8-3 8m30-8-3 8" />
            </g>
          )}
        </svg>
      </svg>
    </span>
  );
}
