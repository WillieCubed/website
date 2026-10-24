import type { Place } from '@/lib/initiatives/index';
import { repeatedPlaceNames, uniquePlaces } from '@/lib/initiatives/places';
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
  hubs: Set<string>;
}

function Geography({ places, routes, connect, title, hubs }: GeographyProps) {
  const { project, land, islandLand, height } = routeGeography(places);
  const names = new Set(places.map((place) => place.name));
  return (
    <RouteMapCanvas
      title={`${title}: ${places.map((place) => place.name).join(', ')}`}
      compact={places.every(isHawaii)}
      height={height}
      points={places.map((place) => {
        const [x, y] = project(place);
        return { name: place.name, x, y, hub: hubs.has(place.name) };
      })}
    >
      <g className="route-map__land" aria-hidden="true">
        {land.map((outline, index) => (
          <path key={index} d={outline} />
        ))}
      </g>
      {islandLand.length > 0 && (
        <svg
          {...HAWAII_INSET}
          viewBox="0 0 800 440"
          className="route-map__islands"
          overflow="visible"
          role="img"
          aria-label={`Hawaii inset: ${places
            .filter(isHawaii)
            .map((place) => place.name)
            .join(', ')}`}
        >
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
              return (
                <path
                  key={stop}
                  data-inset-leg={
                    isHawaii(previous) !== isHawaii(place) || undefined
                  }
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
  const hubs = repeatedPlaceNames(trips.flatMap((trip) => trip.places));
  return (
    <figure className="route-map rounded-4xl border border-line bg-card">
      <Geography
        places={uniquePlaces(places)}
        routes={trips}
        connect={connect}
        title={title}
        hubs={hubs}
      />
      <figcaption>
        {routes ? (
          <ol className="route-map__trips" role="list">
            {routes.map((route, index) => (
              <li key={index} data-route={index % 4}>
                <strong>{route.label}</strong>
                <ol
                  className="route-map__stops"
                  role="list"
                  aria-label={`${route.label} stops`}
                >
                  {route.places.map((place, stop) => (
                    <li key={stop}>{place.name}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="route-map__stops" role="list" data-route="0">
            {places.map((place, index) => (
              <li key={index}>
                {place.name}
                {place.region ? `, ${place.region}` : ''}
              </li>
            ))}
          </ol>
        )}
      </figcaption>
    </figure>
  );
}
