import assert from 'node:assert/strict';
import test from 'node:test';

import type { EntityCard } from '@/lib/entities/types';
import {
  type Initiative,
  type Part,
  loadAllInitiatives,
} from '@/lib/initiatives';
import {
  collectSearchDocuments,
  initiativeToItems,
  pageToItem,
  writingToItem,
} from '@/lib/search/collect';
import { UNDATED } from '@/lib/search/types';
import { type WritingData, getWritingSlugs, loadWriting } from '@/lib/writings';

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    number: 1,
    title: 'Las Vegas',
    tagline: 'Where the tour starts.',
    starts: new Date(2026, 8, 18),
    ends: new Date(2026, 8, 20),
    places: [{ name: 'Las Vegas', lat: 36.17, lng: -115.14 }],
    milestones: [],
    draft: false,
    slug: 'part-1',
    initiative: 'fall-tour-2026',
    status: 'planned',
    content: 'We leave **early** from [home](/).',
    ...overrides,
  };
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    title: 'Fall Tour 2026',
    tagline: 'A tour.',
    description: 'A four-part tour.',
    kind: 'campaign',
    partLabel: 'Part',
    links: [],
    syndication: [],
    draft: false,
    slug: 'fall-tour-2026',
    status: 'planned',
    content: 'The plan, in **bold**.',
    parts: [makePart()],
    href: '/initiatives/fall-tour-2026',
    starts: new Date(2026, 8, 18),
    ...overrides,
  };
}

test('initiativeToItems emits the initiative and each part with unique keys', () => {
  const items = initiativeToItems(
    makeInitiative({
      parts: [
        makePart(),
        makePart({ number: 2, slug: 'part-2', title: 'Reno' }),
      ],
    })
  );
  assert.deepEqual(
    items.map((item) => item.slug),
    [
      'initiatives/fall-tour-2026',
      'initiatives/fall-tour-2026/part-1',
      'initiatives/fall-tour-2026/part-2',
    ]
  );
  assert.deepEqual(
    items.map((item) => item.path),
    [
      '/initiatives/fall-tour-2026',
      '/initiatives/fall-tour-2026/part-1',
      '/initiatives/fall-tour-2026/part-2',
    ]
  );
  assert.ok(items.every((item) => item.type === 'initiative'));
});

test('initiativeToItems skips a draft initiative and draft parts', () => {
  assert.deepEqual(initiativeToItems(makeInitiative({ draft: true })), []);
  const items = initiativeToItems(
    makeInitiative({
      parts: [makePart(), makePart({ number: 2, slug: 'part-2', draft: true })],
    })
  );
  assert.deepEqual(
    items.map((item) => item.slug),
    ['initiatives/fall-tour-2026', 'initiatives/fall-tour-2026/part-1']
  );
});

test('part items are titled like the part page and searchable by place', () => {
  const [, part] = initiativeToItems(makeInitiative());
  assert.equal(part.title, 'Part 1: Las Vegas');
  assert.ok(part.content.includes('Las Vegas'));
  assert.ok(part.content.includes('early'));
  assert.ok(!part.content.includes('**'));
  assert.ok(!part.content.includes('](/)'));
});

test('undated initiatives use UNDATED and dated ones use their start', () => {
  const [undated] = initiativeToItems(makeInitiative({ starts: undefined }));
  assert.equal(undated.published, UNDATED);
  const [dated] = initiativeToItems(makeInitiative());
  assert.equal(dated.published, new Date(2026, 8, 18).toISOString());
});

test('pageToItem keys pages by href and leaves them undated', () => {
  const home: EntityCard = {
    href: '/',
    kind: 'page',
    title: 'Willie Chalmers III',
    description: 'Builds software.',
  };
  const writings: EntityCard = {
    ...home,
    href: '/writings',
    title: 'Writings',
  };
  assert.equal(pageToItem(home).slug, 'pages/home');
  assert.equal(pageToItem(home).path, '/');
  assert.equal(pageToItem(writings).slug, 'pages/writings');
  assert.equal(pageToItem(writings).published, UNDATED);
  assert.equal(pageToItem(writings).type, 'page');
});

test('writingToItem maps a writing to a rooted, dated item', () => {
  const writing: WritingData = {
    slug: 'hello',
    title: 'Hello',
    description: 'A note.',
    published: new Date('2026-01-04T00:00:00Z'),
    lastUpdated: new Date('2026-01-04T00:00:00Z'),
    tags: ['personal'],
    draft: false,
    readingTime: 1,
    postType: 'article',
  };
  const item = writingToItem(writing, 'Some **bold** words.');
  assert.equal(item.slug, 'hello');
  assert.equal(item.path, '/writings/hello');
  assert.equal(item.published, '2026-01-04T00:00:00.000Z');
  assert.equal(item.content, 'Some bold words.');
  assert.equal(item.type, 'writing');
});

test('collectSearchDocuments never includes a draft', async () => {
  const keys = new Set(
    (await collectSearchDocuments()).map((item) => item.slug)
  );

  for (const slug of await getWritingSlugs()) {
    const { writing } = await loadWriting(slug);
    if (writing.draft) {
      assert.ok(!keys.has(slug), `draft writing ${slug} was indexed`);
    }
  }
  for (const initiative of loadAllInitiatives({ includeDrafts: true })) {
    const base = `initiatives/${initiative.slug}`;
    if (initiative.draft) {
      const leaked = [...keys].filter(
        (key) => key === base || key.startsWith(`${base}/`)
      );
      assert.deepEqual(leaked, [], `draft initiative ${base} was indexed`);
      continue;
    }
    for (const part of initiative.parts) {
      if (part.draft) {
        assert.ok(!keys.has(`${base}/${part.slug}`), `draft part ${part.slug}`);
      }
    }
  }
});

test('collectSearchDocuments returns unique keys, rooted paths, and the static pages', async () => {
  const items = await collectSearchDocuments();
  assert.equal(new Set(items.map((item) => item.slug)).size, items.length);
  assert.ok(items.every((item) => item.path.startsWith('/')));
  for (const key of ['pages/home', 'pages/writings', 'pages/initiatives']) {
    assert.ok(
      items.some((item) => item.slug === key),
      `missing ${key}`
    );
  }
});
