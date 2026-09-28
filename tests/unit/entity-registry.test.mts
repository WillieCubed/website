import assert from 'node:assert/strict';
import test from 'node:test';

import { entityKey } from '@/lib/entities/key';
import { STATIC_PAGES } from '@/lib/entities/pages';
import { entityCards } from '@/lib/entities/registry';
import { VENTURE_CARDS } from '@/lib/entities/ventures';
import type { Initiative, Part } from '@/lib/initiatives';
import type { WritingData } from '@/lib/writings';

function makeWriting(overrides: Partial<WritingData> = {}): WritingData {
  return {
    slug: 'hello',
    title: 'Hello',
    description: 'A note.',
    published: new Date('2026-01-04T20:00:00Z'),
    lastUpdated: new Date('2026-01-04T20:00:00Z'),
    tags: [],
    draft: false,
    readingTime: 3,
    postType: 'article',
    ...overrides,
  };
}

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    number: 1,
    title: 'Las Vegas',
    tagline: 'Where the tour starts.',
    starts: new Date(2026, 8, 18, 12),
    ends: new Date(2026, 8, 20, 12),
    places: [],
    milestones: [],
    draft: false,
    slug: 'part-1',
    initiative: 'fall-tour-2026',
    status: 'planned',
    content: '',
    ...overrides,
  };
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    title: 'Fall Tour 2026',
    tagline: 'A tour.',
    description: 'A four-part tour.',
    kind: 'campaign',
    partLabel: 'Leg',
    links: [],
    syndication: [],
    draft: false,
    slug: 'fall-tour-2026',
    status: 'planned',
    content: '',
    parts: [makePart()],
    href: '/initiatives/fall-tour-2026',
    brand: '#c2410c',
    cover: { src: '/tour.jpg', alt: 'A road.' },
    starts: new Date(2026, 8, 18, 12),
    ends: new Date(2026, 9, 30, 12),
    ...overrides,
  };
}

test('with no content the registry is the static pages and ventures', () => {
  assert.deepEqual(entityCards([], []), [...STATIC_PAGES, ...VENTURE_CARDS]);
});

test('a writing gets a card with its date, reading time, and cover', () => {
  const cards = entityCards(
    [makeWriting({ featuredImage: '/hello.jpg', featuredImageAlt: 'A wave.' })],
    []
  );
  assert.deepEqual(cards.at(-1), {
    href: '/writings/hello',
    kind: 'writing',
    title: 'Hello',
    description: 'A note.',
    cover: { src: '/hello.jpg', alt: 'A wave.' },
    meta: 'January 4, 2026 · 3 min read',
  });
});

test('a writing without a featured image has no cover', () => {
  const [card] = entityCards([makeWriting()], []).slice(-1);
  assert.equal(card.cover, undefined);
});

test('a featured writing cannot publish a blank cover description', () => {
  assert.throws(
    () => entityCards([makeWriting({ featuredImage: '/hello.jpg' })], []),
    /featured image without alt text/
  );
});

test('an initiative and each of its parts get cards', () => {
  const initiative = makeInitiative({
    parts: [
      makePart(),
      makePart({
        number: 2,
        slug: 'part-2',
        title: 'Reno',
        tagline: undefined,
        description: undefined,
        starts: new Date(2026, 8, 21, 12),
        ends: new Date(2026, 8, 24, 12),
      }),
    ],
  });
  const [card, first, second] = entityCards([], [initiative]).slice(-3);

  assert.deepEqual(card, {
    href: '/initiatives/fall-tour-2026',
    kind: 'initiative',
    title: 'Fall Tour 2026',
    description: 'A tour.',
    cover: { src: '/tour.jpg', alt: 'A road.' },
    brand: '#c2410c',
    meta: 'Sep 18 – Oct 30',
  });
  assert.equal(first.href, '/initiatives/fall-tour-2026/part-1');
  assert.equal(first.kind, 'part');
  assert.equal(first.description, 'Where the tour starts.');
  assert.equal(first.meta, 'Fall Tour 2026 · Leg 1 of 2 · Sep 18 – Sep 20');
  // A part without its own words or cover borrows the initiative's.
  assert.equal(second.description, 'A tour.');
  assert.deepEqual(second.cover, { src: '/tour.jpg', alt: 'A road.' });
  assert.equal(second.brand, '#c2410c');
  assert.equal(second.meta, 'Fall Tour 2026 · Leg 2 of 2 · Sep 21 – Sep 24');
});

test('a brand that is not a hex seed and a missing date range are left off', () => {
  const [card] = entityCards(
    [],
    [
      makeInitiative({
        brand: 'orange',
        starts: undefined,
        ends: undefined,
        parts: [],
      }),
    ]
  ).slice(-1);
  assert.equal(card.brand, undefined);
  assert.equal(card.meta, undefined);
});

test('each tag the writings carry gets one card with a count line', () => {
  const cards = entityCards(
    [
      makeWriting({ slug: 'a', tags: ['note', 'Fall-Tour-2026'] }),
      makeWriting({ slug: 'b', tags: ['note'] }),
    ],
    []
  );
  assert.deepEqual(
    cards.filter((card) => card.kind === 'tag'),
    [
      {
        href: '/writings/tags/fall-tour-2026',
        kind: 'tag',
        title: 'fall-tour-2026',
        description: '1 writing',
      },
      {
        href: '/writings/tags/note',
        kind: 'tag',
        title: 'note',
        description: '2 writings',
      },
    ]
  );
});

test('a tag page is keyed by its path however the link spells it', () => {
  for (const href of [
    '/writings/tags/note',
    '/writings/tags/note/',
    '/writings/tags/note#top',
    '/writings/tags/note?tag=note',
    'https://willie.page/writings/tags/note',
  ]) {
    assert.equal(entityKey(href), '/writings/tags/note', href);
  }
});

test('an old tag filter link is keyed as the tag page it redirects to', () => {
  assert.equal(entityKey('/writings?tag=note'), '/writings/tags/note');
  assert.equal(entityKey('/writings/?tag=Note#x'), '/writings/tags/note');
  assert.equal(
    entityKey('https://willie.page/writings?tag=fall-tour-2026'),
    '/writings/tags/fall-tour-2026'
  );
  assert.equal(
    entityKey('/writings?tag=caf%C3%A9'),
    '/writings/tags/caf%C3%A9'
  );
  // Only /writings reads the query, and an empty one is the index itself.
  assert.equal(entityKey('/writings?tag='), '/writings');
  assert.equal(entityKey('/initiatives?tag=note'), '/initiatives');
});

test('the card for an old tag link is the tag page card', () => {
  const cards = entityCards([makeWriting({ tags: ['note'] })], []);
  const known = new Map(cards.map((card) => [entityKey(card.href), card]));
  assert.equal(known.get(entityKey('/writings?tag=note'))?.title, 'note');
});
