import { mf2 } from 'microformats-parser';
import type { MicroformatRoot } from 'microformats-parser/dist/types';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PartEvent from '@/components/initiatives/PartEvent';

import { site } from '@/lib/site';

const url = `${site.origin}/initiatives/fall-tour-2026/part-1`;

const initiative = { title: 'Fall Tour 2026', partLabel: 'Part' };

// Parts store their days as local midnight (lib/initiatives/schema.ts).
const part = {
  number: 1,
  title: 'A Boy Goes Back to Dallas',
  tagline: 'The annual DFW visit, with a concert as the excuse.',
  starts: new Date(2026, 8, 24),
  ends: new Date(2026, 8, 27),
  places: [
    { name: 'Dallas', region: 'TX', lat: 32.8471, lng: -96.8518 },
    { name: 'Denton', lat: 33.2148, lng: -97.1331 },
  ],
};

function parse(props: Parameters<typeof PartEvent>[0]): {
  html: string;
  event: MicroformatRoot;
} {
  const html = renderToStaticMarkup(createElement(PartEvent, props));
  const { items } = mf2(html, { baseUrl: url });
  assert.equal(items.length, 1);
  const [event] = items;
  assert.deepEqual(event.type, ['h-event']);
  return { html, event };
}

function embedded(value: unknown): MicroformatRoot {
  assert.ok(typeof value === 'object' && value !== null && 'type' in value);
  return value as MicroformatRoot;
}

test('a part is an h-event named, dated, and linked like the page', () => {
  const { event } = parse({ initiative, part, url });

  assert.deepEqual(event.properties.name, [
    'Fall Tour 2026 Part 1: A Boy Goes Back to Dallas',
  ]);
  assert.deepEqual(event.properties.url, [url]);
  assert.deepEqual(event.properties.start, ['2026-09-24']);
  assert.deepEqual(event.properties.end, ['2026-09-27']);
  assert.deepEqual(event.properties.summary, [part.tagline]);
});

test('each place is a p-location h-adr with its coordinates', () => {
  const { event } = parse({ initiative, part, url });
  const locations = (event.properties.location ?? []).map(embedded);

  assert.equal(locations.length, 2);
  assert.ok(locations.every((location) => location.type[0] === 'h-adr'));
  assert.deepEqual(locations[0].properties, {
    locality: ['Dallas'],
    region: ['TX'],
    latitude: ['32.8471'],
    longitude: ['-96.8518'],
  });
  assert.ok(!('region' in locations[1].properties));
  assert.deepEqual(locations[1].properties.latitude, ['33.2148']);
});

test('the visible line still reads as the dates and the places', () => {
  const { html } = parse({ initiative, part, url });
  const text = html.replace(/<[^>]+>/g, '');

  assert.match(text, /Sep 24 – 27, 2026 · Dallas, Denton/);
});

test('a part with no tagline or places leaves those properties out', () => {
  const { event } = parse({
    initiative,
    part: { ...part, tagline: undefined, places: [] },
    url,
  });

  assert.ok(!('summary' in event.properties));
  assert.ok(!('location' in event.properties));
});
