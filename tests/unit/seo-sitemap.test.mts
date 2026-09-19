import assert from 'node:assert/strict';
import test from 'node:test';

import type { Initiative, Part } from '@/lib/initiatives';
import { buildSitemap } from '@/lib/seo/sitemap';
import { site } from '@/lib/site';
import type { WritingData } from '@/lib/writings';

function part(overrides: Partial<Part> = {}): Part {
  return {
    number: 1,
    title: 'Las Vegas',
    starts: new Date(2026, 8, 18),
    ends: new Date(2026, 8, 20),
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

function initiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    title: 'Fall Tour 2026',
    tagline: 'A tour.',
    description: 'A tour.',
    kind: 'campaign',
    partLabel: 'Part',
    links: [],
    syndication: [],
    draft: false,
    slug: 'fall-tour-2026',
    status: 'planned',
    content: '',
    parts: [part()],
    href: '/initiatives/fall-tour-2026',
    ends: new Date(2026, 10, 1),
    ...overrides,
  };
}

function writing(overrides: Partial<WritingData> = {}): WritingData {
  return {
    slug: 'hello',
    title: 'Hello',
    description: 'A note.',
    published: new Date('2026-01-04T00:00:00Z'),
    lastUpdated: new Date('2026-02-01T00:00:00Z'),
    tags: [],
    draft: false,
    readingTime: 1,
    postType: 'article',
    ...overrides,
  };
}

test('every entry is absolute, unique, and free of ignored hints', () => {
  const entries = buildSitemap({
    writings: [writing()],
    initiatives: [initiative()],
  });
  const urls = entries.map((entry) => entry.url);
  assert.deepEqual(urls, [
    `${site.origin}/`,
    `${site.origin}/writings`,
    `${site.origin}/initiatives`,
    `${site.origin}/initiatives/fall-tour-2026`,
    `${site.origin}/initiatives/fall-tour-2026/part-1`,
    `${site.origin}/writings/hello`,
  ]);
  assert.equal(new Set(urls).size, urls.length);
  for (const entry of entries) {
    assert.ok(!('priority' in entry));
    assert.ok(!('changeFrequency' in entry));
  }
});

test('lastModified is set only from a known edit date', () => {
  const entries = buildSitemap({
    writings: [writing()],
    initiatives: [
      initiative({
        updated: new Date(2026, 8, 1),
        parts: [
          part(),
          part({ number: 2, slug: 'part-2', updated: new Date(2026, 8, 2) }),
        ],
      }),
    ],
  });
  const byUrl = new Map(entries.map((entry) => [entry.url, entry]));
  assert.equal(byUrl.get(`${site.origin}/`)?.lastModified, undefined);
  assert.deepEqual(
    byUrl.get(`${site.origin}/initiatives/fall-tour-2026`)?.lastModified,
    new Date(2026, 8, 1)
  );
  assert.equal(
    byUrl.get(`${site.origin}/initiatives/fall-tour-2026/part-1`)?.lastModified,
    undefined
  );
  assert.deepEqual(
    byUrl.get(`${site.origin}/initiatives/fall-tour-2026/part-2`)?.lastModified,
    new Date(2026, 8, 2)
  );
  assert.deepEqual(
    byUrl.get(`${site.origin}/writings/hello`)?.lastModified,
    new Date('2026-02-01T00:00:00Z')
  );
});

test('the event end date is never used as a modified date', () => {
  const entries = buildSitemap({ writings: [], initiatives: [initiative()] });
  const entry = entries.find((item) => item.url.endsWith('/fall-tour-2026'));
  assert.equal(entry?.lastModified, undefined);
});

test('drafts are left out even if a loader hands them over', () => {
  const entries = buildSitemap({
    writings: [writing({ slug: 'secret', draft: true })],
    initiatives: [
      initiative({ slug: 'hidden', href: '/initiatives/hidden', draft: true }),
      initiative({
        parts: [part(), part({ number: 2, slug: 'part-2', draft: true })],
      }),
    ],
  });
  const urls = entries.map((entry) => entry.url);
  assert.ok(!urls.some((url) => url.includes('secret')));
  assert.ok(!urls.some((url) => url.includes('hidden')));
  assert.ok(!urls.some((url) => url.endsWith('/part-2')));
  assert.ok(urls.includes(`${site.origin}/initiatives/fall-tour-2026/part-1`));
});
