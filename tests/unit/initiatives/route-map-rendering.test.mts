import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import RouteMap from '@/components/initiatives/RouteMap';

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
  const path = html.match(/<path\b[^>]*d="([^"]+)"/)?.[1];
  assert.equal((path?.match(/L/g) || []).length, places.length - 1);
  assert.match(
    html,
    /aria-label="Fall Tour: Dallas, Plano, Denton, San Francisco, Reno, Los Angeles"/
  );
});

test('unconnected maps keep every place and empty maps render nothing', () => {
  const html = renderToStaticMarkup(
    createElement(RouteMap, { places, connect: false })
  );
  assert.doesNotMatch(html, /<path\b/);
  assert.equal((html.match(/<circle\b/g) || []).length, places.length);
  assert.equal(
    renderToStaticMarkup(createElement(RouteMap, { places: [] })),
    ''
  );
});
