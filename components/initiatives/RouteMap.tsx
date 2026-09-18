import type { Place } from '@/lib/initiatives';

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

/**
 * An honest little map: places projected onto a plain graticule and joined
 * in order. There is no outline because a hand-drawn continent would be a
 * lie about precision this page does not have.
 */
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
    PAD + ((lng - minLng) / (maxLng - minLng || 1)) * (WIDTH - PAD * 2);
  const y = (lat: number) =>
    HEIGHT -
    PAD -
    ((lat - minLat) / (maxLat - minLat || 1)) * (HEIGHT - PAD * 2);
  const points = places.map((p) => [x(p.lng), y(p.lat)] as const);
  const path = points
    .map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`)
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
          // Alternate label sides so neighbouring cities do not overprint.
          const crowded = points.some(
            ([ox, oy], j) =>
              j < i && Math.abs(ox - px) < 110 && Math.abs(oy - py) < 40
          );
          const labelBelow = crowded ? i % 2 === 0 : py < HEIGHT / 2;
          return (
            <g key={`${place.name}-${i}`}>
              <circle cx={px} cy={py} r="7" />
              <text
                x={px}
                y={labelBelow ? py + 24 : py - 14}
                textAnchor="middle"
                fontSize="14"
                fontFamily="var(--font-mono)"
                fill="var(--color-ink)"
              >
                {place.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {places
          .map((p) => `${p.name}${p.region ? `, ${p.region}` : ''}`)
          .join(' → ')}
      </figcaption>
    </figure>
  );
}
