import type { Place } from '@/lib/initiatives/index';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  geographicView,
  isHawaii,
  linePath,
} from '@/lib/initiatives/route-geography';

interface RouteGroup {
  label: string;
  places: Place[];
}

interface RouteMapProps {
  /** Places in travel order. */
  places: Place[];
  /** Separate trips never imply travel between their endpoints. */
  routes?: RouteGroup[];
  connect?: boolean;
  title?: string;
}

interface GeographyProps {
  places: Place[];
  routes: RouteGroup[];
  connect: boolean;
  title: string;
  mainland?: boolean;
}

function Geography({
  places,
  routes,
  connect,
  title,
  mainland = false,
}: GeographyProps) {
  const { project, land } = geographicView(places, mainland);
  const includes = (place: Place) =>
    places.some((point) => point.name === place.name);
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      role="img"
      aria-label={`${title}: ${places.map((place) => place.name).join(', ')}`}
      className="route-map__geography"
    >
      <g className="route-map__land" aria-hidden="true">
        {land.map((outline, index) => (
          <path key={index} d={outline} />
        ))}
      </g>
      {connect &&
        routes.map((route, index) => (
          <g key={index} className="route-map__journey" data-route={index % 4}>
            {route.places.slice(1).map((place, stop) => {
              const previous = route.places[stop];
              if (!includes(previous) || !includes(place)) return null;
              return (
                <path
                  key={stop}
                  d={linePath([
                    project(previous.lng, previous.lat),
                    project(place.lng, place.lat),
                  ])}
                />
              );
            })}
          </g>
        ))}
      {places.map((place, index) => {
        const [x, y] = project(place.lng, place.lat);
        return (
          <g key={index}>
            <title>{`${place.name}${place.region ? `, ${place.region}` : ''}`}</title>
            <circle cx={x} cy={y} r="5" />
          </g>
        );
      })}
    </svg>
  );
}

export default function RouteMap({
  places,
  routes,
  connect = true,
  title = 'Route',
}: RouteMapProps) {
  if (places.length === 0) return null;
  const trips = routes ?? [{ label: title, places }];
  const islands = places.filter(isHawaii);
  const separateHawaii = islands.length > 0 && islands.length < places.length;
  const main = separateHawaii
    ? places.filter((place) => !isHawaii(place))
    : places;
  const mainland = main.every(
    (place) =>
      place.lng >= -126 &&
      place.lng <= -66 &&
      place.lat >= 24 &&
      place.lat <= 50
  );
  return (
    <figure className="route-map rounded-2xl border border-line bg-card">
      <div className="route-map__atlas">
        <Geography
          places={main}
          routes={trips}
          connect={connect}
          title={title}
          mainland={mainland}
        />
        {separateHawaii && (
          <div className="route-map__inset">
            <Geography
              places={islands}
              routes={trips}
              connect={connect}
              title="Hawaii inset"
            />
            <p>Hawaii · separate scale</p>
          </div>
        )}
      </div>
      <figcaption>
        {routes ? (
          <ol className="route-map__trips">
            {routes.map((route, index) => (
              <li key={index} data-route={index % 4}>
                <span className="route-map__key" aria-hidden="true" />
                <div>
                  <strong>{route.label}</strong>
                  <p>{route.places.map((place) => place.name).join(' → ')}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="route-map__places">
            {places.map((place, index) => (
              <li key={index}>
                {place.name}
                {place.region ? `, ${place.region}` : ''}
              </li>
            ))}
          </ol>
        )}
        {separateHawaii && (
          <p className="route-map__note">
            Honolulu appears in the inset. The inset does not show distance from
            the mainland.
          </p>
        )}
      </figcaption>
    </figure>
  );
}
