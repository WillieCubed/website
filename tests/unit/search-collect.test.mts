import assert from 'node:assert/strict';
import test from 'node:test';

import type { EntityCard } from '@/lib/entities/types';
import { entries, ventures } from '@/lib/home/ventures';
import {
  type Initiative,
  type Part,
  loadAllInitiatives,
} from '@/lib/initiatives';
import {
  collectSearchDocuments,
  entryToItem,
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
  assert.equal(pageToItem(home).content, '');
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

test('the search text keeps prose that JSX, code spans, and underscores used to eat', () => {
  const text = (content: string) =>
    writingToItem(
      {
        slug: 'x',
        title: 'X',
        description: '',
        published: new Date('2026-01-04T00:00:00Z'),
        lastUpdated: new Date('2026-01-04T00:00:00Z'),
        tags: [],
        draft: false,
        readingTime: 1,
        postType: 'article',
      },
      content
    ).content;

  assert.equal(
    text(
      'Use `Promise<Response>` here. Keep this sentence.\n\n<Aside>side</Aside> end'
    ),
    'Use  here. Keep this sentence.\n\nside end'
  );
  assert.equal(text('before <Callout tone={a > b} /> after'), 'before  after');
  assert.equal(
    text('The flag is snake_case_name in config.'),
    'The flag is snake_case_name in config.'
  );
  assert.equal(
    text('A <Ref href="/x">important cited text</Ref> B'),
    'A important cited text B'
  );
  assert.equal(
    text('An _emphasised_ word and __strong__ one.'),
    'An emphasised word and strong one.'
  );
});

test('entryToItem links a venture to its detail view and keeps its list searchable', () => {
  const item = entryToItem(entries.lvbt);
  assert.equal(item.slug, 'ventures/lvbt');
  assert.equal(item.path, '/?detail=lvbt');
  assert.equal(item.title, 'Las Vegans for Better Transit');
  assert.equal(item.description, entries.lvbt.detail.body[0]);
  assert.ok(item.content.includes('Week Without Driving'));
  assert.equal(item.type, 'page');
  assert.equal(item.published, UNDATED);
});

test('entryToItem tags a product with the studio it belongs to', () => {
  const item = entryToItem(entries.logdate);
  assert.equal(item.path, '/?detail=logdate');
  assert.deepEqual(item.tags, ['Hypertext Studio']);
});

test('collectSearchDocuments indexes every shown venture and product, and no hidden one', async () => {
  const keys = new Set(
    (await collectSearchDocuments()).map((item) => item.slug)
  );
  for (const id of Object.keys(entries)) {
    assert.ok(keys.has(`ventures/${id}`), `${id} is indexed`);
  }
  for (const venture of ventures.filter((v) => v.hidden)) {
    assert.ok(
      !keys.has(`ventures/${venture.id}`),
      `hidden ${venture.id} was indexed`
    );
  }
});
