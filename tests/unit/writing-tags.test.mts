import assert from 'node:assert/strict';
import test from 'node:test';

import type { WritingData } from '@/lib/writings';
import {
  groupByTag,
  normalizeTag,
  tagFromParam,
  tagPath,
  writingCount,
} from '@/lib/writings/tags';

function makeWriting(overrides: Partial<WritingData> = {}): WritingData {
  return {
    slug: 'hello',
    title: 'Hello',
    hasExplicitTitle: true,
    description: 'A note.',
    published: new Date('2026-01-04T20:00:00Z'),
    lastUpdated: new Date('2026-01-04T20:00:00Z'),
    tags: [],
    people: [],
    draft: false,
    featured: false,
    readingTime: 1,
    postType: 'article',
    ...overrides,
  };
}

test('a tag page lives under /writings/tags at its lowercase spelling', () => {
  assert.equal(tagPath('fall-tour-2026'), '/writings/tags/fall-tour-2026');
  assert.equal(tagPath(' IndieWeb '), '/writings/tags/indieweb');
  assert.equal(tagPath('café au lait'), '/writings/tags/caf%C3%A9%20au%20lait');
  assert.equal(normalizeTag('Note'), 'note');
});

test('a route segment reads back as the tag it was built from', () => {
  for (const tag of ['note', 'café au lait', '100%']) {
    const segment = tagPath(tag).split('/').at(-1) ?? '';
    assert.equal(tagFromParam(segment), tag);
  }
  // A segment that arrives decoded, or holds a bare %, is taken as written.
  assert.equal(tagFromParam('café au lait'), 'café au lait');
  assert.equal(tagFromParam('100%'), '100%');
  assert.equal(tagFromParam('Note'), 'note');
});

test('the count line reads as plain English', () => {
  assert.equal(writingCount(1), '1 writing');
  assert.equal(writingCount(3), '3 writings');
});

test('groupByTag lists each tag once, sorted, with its writings in order', () => {
  const first = makeWriting({
    slug: 'first',
    tags: ['note', 'Fall-Tour-2026'],
  });
  const second = makeWriting({ slug: 'second', tags: ['note', 'NOTE', ''] });
  const groups = groupByTag([first, second]);
  assert.deepEqual(
    groups.map(({ tag, writings }) => [tag, writings.map((w) => w.slug)]),
    [
      ['fall-tour-2026', ['first']],
      ['note', ['first', 'second']],
    ]
  );
  assert.deepEqual(groupByTag([]), []);
});
