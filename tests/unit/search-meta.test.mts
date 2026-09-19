import assert from 'node:assert/strict';
import test from 'node:test';

import { resultMeta } from '@/lib/search/meta';
import { type SearchResult, UNDATED } from '@/lib/search/types';
import { formatDate } from '@/lib/site';

const base: SearchResult = {
  slug: 'x',
  path: '/x',
  title: 'X',
  description: '',
  content: '',
  tags: [],
  published: UNDATED,
  type: 'page',
};

test('page results show only their type', () => {
  assert.deepEqual(resultMeta(base), [{ kind: 'type', text: 'page' }]);
});

test('initiative results show their type, then tags', () => {
  assert.deepEqual(
    resultMeta({ ...base, type: 'initiative', tags: ['campaign', 'x', 'y'] }),
    [
      { kind: 'type', text: 'initiative' },
      { kind: 'tags', text: 'campaign, x' },
    ]
  );
});

test('writing results show a date then tags, and never a type badge', () => {
  const published = '2026-01-04T12:00:00.000Z';
  const writing = { ...base, type: 'writing' as const, published };
  assert.deepEqual(resultMeta({ ...writing, tags: ['a', 'b', 'c'] }), [
    { kind: 'date', text: formatDate(published, 'short'), dateTime: published },
    { kind: 'tags', text: 'a, b' },
  ]);
  assert.deepEqual(resultMeta(writing), [
    { kind: 'date', text: formatDate(published, 'short'), dateTime: published },
  ]);
});
