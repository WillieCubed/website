import type { Place } from '@/lib/initiatives/index';

interface RouteMapProps {
  /** Places in travel order. */
  places: Place[];
  /** Draw a dashed line between places in order. */
  connect?: boolean;
  title?: string;
}

const WIDTH = 800;
const HEIGHT = 320;
const PAD = 48;

export default function RouteMap({
  places,
  connect = true,
  title = 'Route',
}: RouteMapProps) {
  if (places.length === 0) return null;
  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const minLat = Math.min(...lats) - 2;
  const maxLat = Math.max(...lats) + 2;
  const minLng = Math.min(...lngs) - 3;
  const maxLng = Math.max(...lngs) + 3;
  const x = (lng: number) =>
    PAD +
    ((lng - minLng) / (maxLng === minLng ? 1 : maxLng - minLng)) *
      (WIDTH - PAD * 2);
  const y = (lat: number) =>
    HEIGHT -
    PAD -
    ((lat - minLat) / (maxLat === minLat ? 1 : maxLat - minLat)) *
      (HEIGHT - PAD * 2);
  const points = places.map((p) => [x(p.lng), y(p.lat)] as const);
  const path = points
    .map(([px, py], i) => `${i > 0 ? 'L' : 'M'}${px} ${py}`)
    .join(' ');

  return (
    <figure className="route-map rounded-2xl border border-line bg-card p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}: ${places.map((p) => p.name).join(', ')}`}
        className="h-auto w-full"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={PAD}
            x2={WIDTH - PAD}
            y1={PAD + (i * (HEIGHT - PAD * 2)) / 5}
            y2={PAD + (i * (HEIGHT - PAD * 2)) / 5}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`v${i}`}
            y1={PAD}
            y2={HEIGHT - PAD}
            x1={PAD + (i * (WIDTH - PAD * 2)) / 8}
            x2={PAD + (i * (WIDTH - PAD * 2)) / 8}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}
        {connect && points.length > 1 && (
          <path
            d={path}
            fill="none"
            strokeWidth="3"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
        )}
        {places.map((place, i) => {
          const [px, py] = points[i];
          return (
            <g key={`${place.name}-${i}`}>
              <title>{`${place.name}${place.region ? `, ${place.region}` : ''}`}</title>
              <circle cx={px} cy={py} r="7" />
            </g>
          );
        })}
      </svg>
      <figcaption>
        {/* HTML labels keep nearby stops readable when the map scales down. */}
        <ol className="mt-3 grid list-decimal grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-x-8 gap-y-2 pl-6 text-sm text-muted sm:grid-cols-3">
          {places.map((place, i) => (
            <li key={`${place.name}-${i}`} className="min-w-0 break-words">
              {place.name}
              {place.region ? `, ${place.region}` : ''}
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
