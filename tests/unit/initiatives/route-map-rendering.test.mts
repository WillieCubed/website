import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});

const { default: RouteMap } = await import('@/components/initiatives/RouteMap');

const places = [
  { name: 'Dallas', region: 'Texas', lat: 32.78, lng: -96.8 },
  { name: 'Plano', region: 'Texas', lat: 33.02, lng: -96.7 },
  { name: 'Denton', region: 'Texas', lat: 33.21, lng: -97.13 },
  { name: 'San Francisco', lat: 37.77, lng: -122.42 },
  { name: 'Reno', lat: 39.53, lng: -119.81 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
];

test('clustered map places have visible HTML labels in travel order and named geographic points', () => {
  const html = renderToStaticMarkup(
    createElement(RouteMap, { places, title: 'Fall Tour' })
  );
  const caption = html.match(
    /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/
  )?.[1];
  assert.ok(caption, 'the map needs a visible caption');
  assert.deepEqual(
    [...caption.matchAll(/<li\b[^>]*>(.*?)<\/li>/g)].map((match) =>
      match[1].replace(/<[^>]+>/g, '')
    ),
    places.map(
      (place) => `${place.name}${place.region ? `, ${place.region}` : ''}`
    )
  );
  assert.doesNotMatch(html, /<figcaption[^>]*sr-only/);
  assert.doesNotMatch(html, /<text\b/);
  assert.deepEqual(
    [...html.matchAll(/<title>(.*?)<\/title>/g)].map((match) => match[1]),
    places.map(
      (place) => `${place.name}${place.region ? `, ${place.region}` : ''}`
    )
  );
  assert.equal((html.match(/<circle\b/g) || []).length, places.length);
  const journeys = html.match(
    /class="route-map__journey"[^>]*>([\s\S]*?)<\/g>/
  )?.[1];
  assert.equal((journeys?.match(/<path\b/g) || []).length, places.length - 1);
  assert.equal((journeys?.match(/ Q/g) || []).length, places.length - 1);
  assert.match(html, /class="route-map__land"/);
  assert.doesNotMatch(html, /<line\b/);
  assert.match(
    html,
    /aria-label="Fall Tour: Dallas, Plano, Denton, San Francisco, Reno, Los Angeles: drag/
  );
});

test('unconnected maps keep every place and empty maps render nothing', () => {
  const html = renderToStaticMarkup(
    createElement(RouteMap, { places, connect: false })
  );
  assert.doesNotMatch(html, /class="route-map__journey"/);
  assert.match(html, /class="route-map__land"/);
  assert.equal((html.match(/<circle\b/g) || []).length, places.length);
  assert.equal(
    renderToStaticMarkup(createElement(RouteMap, { places: [] })),
    ''
  );
});

test('separate trips never connect across their boundaries and Hawaii uses an honest inset', () => {
  const honolulu = { name: 'Honolulu', lat: 21.31, lng: -157.86 };
  const stops = [...places, honolulu];
  const html = renderToStaticMarkup(
    createElement(RouteMap, {
      places: stops,
      routes: [
        { label: 'Part 1', places: places.slice(0, 3) },
        { label: 'Part 4', places: [...places.slice(3), honolulu] },
      ],
    })
  );
  const paths = [
    ...html.matchAll(/class="route-map__journey"[^>]*>([\s\S]*?)<\/g>/g),
  ].flatMap((match) => [...match[1].matchAll(/<path\b/g)]);
  assert.equal(
    paths.length,
    4,
    'two Texas legs and two western legs; no fabricated inter-trip or inter-inset leg'
  );
  assert.match(html, /aria-label="Hawaii inset: Honolulu"/);
  assert.equal((html.match(/class="route-map__interactive"/g) || []).length, 1);
  assert.match(html, /<option value="Honolulu">Honolulu<\/option>/);
  assert.match(html, /class="route-map__islands"/);
  const stopLists = [
    ...html.matchAll(/<ol class="route-map__stops"[^>]*>([\s\S]*?)<\/ol>/g),
  ];
  assert.deepEqual(
    stopLists.map(([, list]) =>
      [...list.matchAll(/<li>(.*?)<\/li>/g)].map(([, name]) => name)
    ),
    [
      ['Dallas', 'Plano', 'Denton'],
      ['San Francisco', 'Reno', 'Los Angeles', 'Honolulu'],
    ]
  );
  assert.equal((html.match(/<circle\b/g) || []).length, stops.length);
});

test('travel curves retain endpoints and a consistent bend in either direction', async () => {
  const { curvedLeg } = await import('@/lib/initiatives/route-geography');
  assert.equal(curvedLeg([0, 0], [100, 0]), 'M0 0 Q50 -22 100 0');
  assert.equal(curvedLeg([100, 0], [0, 0]), 'M100 0 Q50 -22 0 0');
  assert.equal(curvedLeg([0, 0], [1000, 0]), 'M0 0 Q500 -64 1000 0');
  assert.equal(curvedLeg([2, 3], [2, 3]), 'M2 3 Q2 3 2 3');
});

test('the Hawaii inset shares city selection without changing mainland geography', async () => {
  const { routeGeography, geographicView, HAWAII_INSET } =
    await import('@/lib/initiatives/route-geography');
  const honolulu = { name: 'Honolulu', lat: 21.31, lng: -157.86 };
  const { project, islandLand } = routeGeography([...places, honolulu]);
  assert.deepEqual(
    project(places[0]),
    geographicView(places, true).project(-96.8, 32.78)
  );
  const [x, y] = project(honolulu);
  assert.ok(x > HAWAII_INSET.x && x < HAWAII_INSET.x + HAWAII_INSET.width);
  assert.ok(y > HAWAII_INSET.y && y < HAWAII_INSET.y + HAWAII_INSET.height);
  assert.ok(islandLand.length > 0);
});

test('geographic projection keeps western stops west and nearby Texas stops close', async () => {
  const { geographicView } = await import('@/lib/initiatives/route-geography');
  const { project, land } = geographicView(places, true);
  const dallas = project(-96.8, 32.78);
  const plano = project(-96.7, 33.02);
  const sf = project(-122.42, 37.77);
  assert.ok(sf[0] < dallas[0]);
  assert.ok(sf[1] < dallas[1]);
  assert.ok(Math.hypot(plano[0] - dallas[0], plano[1] - dallas[1]) < 5);
  assert.ok(land.length > 0);
  assert.ok(land.every((path) => path.endsWith('Z') && !path.includes('NaN')));
});
