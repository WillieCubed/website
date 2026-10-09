import { safeParse } from '@atcute/lexicons';
import {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';
import assert from 'node:assert/strict';
import test from 'node:test';

import { publishingIdentity } from '@/lib/atproto/config';
import {
  type DocumentSource,
  documentRecord,
  publicationRecord,
} from '@/lib/atproto/records';
import { site } from '@/lib/site';
import { themeSchemes } from '@/lib/theme';

const blob = {
  $type: 'blob' as const,
  ref: { $link: 'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq' },
  mimeType: 'image/png',
  size: 5,
};

const article: DocumentSource = {
  slug: 'fall-tour-2026-begins',
  title: 'Fall Tour 2026 begins',
  description: 'Where I am going and why.',
  published: new Date('2026-09-23T18:51:00-07:00'),
  lastUpdated: new Date('2026-09-23T18:51:00-07:00'),
  tags: ['#travel', 'transit'],
  body: '# Heading\n\nSome **bold** words and [a link](https://example.com).\n\n<Callout>Kept text</Callout>',
};

test('the publication record is valid and wears the site theme', () => {
  const record = publicationRecord(blob);
  const result = safeParse(SiteStandardPublication.mainSchema, record);
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.equal(record.url, site.origin);
  assert.ok(!record.url.endsWith('/'));
  assert.equal(record.name, site.name);
  assert.deepEqual(record.icon, blob);
  assert.equal(
    record.basicTheme?.background.$type,
    'site.standard.theme.color#rgb'
  );
  const surface = Number.parseInt(themeSchemes.light.surface.slice(1), 16);
  assert.equal(record.basicTheme?.background.r, (surface >> 16) & 255);
});

test('an article becomes a valid document under the publication', () => {
  const record = documentRecord(article, { coverImage: blob });
  const result = safeParse(SiteStandardDocument.mainSchema, record);
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.equal(record.site, publishingIdentity().publicationUri);
  assert.equal(record.path, '/writings/fall-tour-2026-begins');
  assert.equal(record.publishedAt, '2026-09-24T01:51:00.000Z');
  assert.equal(record.updatedAt, undefined, 'never edited');
  assert.deepEqual(record.tags, ['travel', 'transit']);
  assert.equal(
    record.textContent,
    'Heading\n\nSome bold words and a link.\n\nKept text'
  );
  assert.deepEqual(record.coverImage, blob);
});

test('an edit sets updatedAt', () => {
  const record = documentRecord({
    ...article,
    lastUpdated: new Date('2026-10-01T09:00:00Z'),
  });
  assert.equal(record.updatedAt, '2026-10-01T09:00:00.000Z');
});

test('a note drops a description that only repeats its title', () => {
  const record = documentRecord({
    ...article,
    slug: 'a-note',
    title: 'A note about the site.',
    description: 'A note about the site.',
    tags: [],
    body: 'A note about the site.',
  });
  assert.equal(record.description, undefined);
  assert.equal(record.tags, undefined);
});

test('a long derived title is clipped to the lexicon limit', () => {
  const record = documentRecord({ ...article, title: '🌵'.repeat(600) });
  assert.equal([...new Intl.Segmenter().segment(record.title)].length, 500);
  assert.ok(record.title.endsWith('…'));
});

test('a known Bluesky post reference is carried on the record', () => {
  const bskyPostRef = {
    uri: `at://${site.author.atprotoDid}/app.bsky.feed.post/3mwa5ei54c22g`,
    cid: 'bafyreihffx5a2e7k5uwrmmgofbvzujc5cmw5h4espouwuxt3liqoflx3ee',
  } as const;
  assert.deepEqual(
    documentRecord(article, { bskyPostRef }).bskyPostRef,
    bskyPostRef
  );
});

test('complete text retains code, reference image descriptions, quotations and table cells', () => {
  const record = documentRecord({
    ...article,
    body: 'Use `value()` now.\n\n```ts\nconst value = 1;\n```\n\n> A quote\n\n![A described image][photo]\n\n[photo]: https://example.com/photo.png\n\n| Name | Value |\n| --- | --- |\n| First | 1 |',
  });
  for (const text of [
    'value()',
    'const value = 1;',
    'A quote',
    'A described image',
    'Name\tValue',
    'First\t1',
  ])
    assert.ok(record.textContent?.includes(text), text);
});

test('UTF-8 byte and grapheme budgets both constrain derived titles', () => {
  const record = documentRecord({ ...article, title: '👩‍👩‍👧‍👦'.repeat(600) });
  assert.ok(Buffer.byteLength(record.title) <= 5000);
  assert.ok(safeParse(SiteStandardDocument.mainSchema, record).ok);
});
