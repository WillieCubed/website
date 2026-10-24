import type { Place } from '@/lib/initiatives/index';
import {
  HAWAII_INSET,
  curvedLeg,
  isHawaii,
  routeGeography,
} from '@/lib/initiatives/route-geography';

import RouteMapCanvas from './RouteMapCanvas';

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
}

function Geography({ places, routes, connect, title }: GeographyProps) {
  const { project, land, islandLand, height } = routeGeography(places);
  const names = new Set(places.map((place) => place.name));
  return (
    <RouteMapCanvas
      title={`${title}: ${places.map((place) => place.name).join(', ')}`}
      compact={places.every(isHawaii)}
      height={height}
      points={places.map((place) => {
        const [x, y] = project(place);
        return { name: place.name, x, y };
      })}
    >
      <svg width="800" height="440" overflow="hidden" aria-hidden="true">
        <g className="route-map__land">
          {land.map((outline, index) => (
            <path key={index} d={outline} />
          ))}
        </g>
      </svg>
      {islandLand.length > 0 && (
        <svg
          {...HAWAII_INSET}
          viewBox="0 0 800 440"
          className="route-map__islands"
          role="img"
          aria-label={`Hawaii inset: ${places
            .filter(isHawaii)
            .map((place) => place.name)
            .join(', ')}`}
        >
          <rect width="800" height="440" rx="48" />
          <g className="route-map__land" aria-hidden="true">
            {islandLand.map((outline, index) => (
              <path key={index} d={outline} />
            ))}
          </g>
        </svg>
      )}
      {connect &&
        routes.map((route, index) => (
          <g key={index} className="route-map__journey" data-route={index % 4}>
            {route.places.slice(1).map((place, stop) => {
              const previous = route.places[stop];
              if (!names.has(previous.name) || !names.has(place.name))
                return null;
              if (isHawaii(previous) !== isHawaii(place)) return null;
              return (
                <path
                  key={stop}
                  d={curvedLeg(project(previous), project(place))}
                />
              );
            })}
          </g>
        ))}
      {places.map((place, index) => {
        const [x, y] = project(place);
        return (
          <g key={index}>
            <title>{`${place.name}${place.region ? `, ${place.region}` : ''}`}</title>
            <circle cx={x} cy={y} r="5" />
          </g>
        );
      })}
    </RouteMapCanvas>
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
  const separateHawaii = places.some(isHawaii) && !places.every(isHawaii);
  return (
    <figure className="route-map rounded-2xl border border-line bg-card">
      <div className="route-map__atlas">
        <Geography
          places={places}
          routes={trips}
          connect={connect}
          title={title}
        />
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
          <p className="route-map__note">Hawaii uses a separate scale.</p>
        )}
      </figcaption>
    </figure>
  );
}
