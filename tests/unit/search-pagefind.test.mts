import assert from 'node:assert/strict';
import test from 'node:test';

import { toPagefindRecord } from '@/lib/search/pagefind';
import { type SearchableItem, UNDATED } from '@/lib/search/types';

const item: SearchableItem = {
  slug: 'hello',
  path: '/writings/hello',
  title: 'Hello',
  description: 'A note.',
  content: 'Body text.',
  tags: ['personal'],
  published: '2026-01-04T00:00:00.000Z',
  type: 'writing',
};

test('toPagefindRecord maps an item to a custom record', () => {
  assert.deepEqual(toPagefindRecord(item), {
    url: '/writings/hello',
    language: 'en',
    content: 'A note.\n\nBody text.',
    meta: { title: 'Hello', description: 'A note.', type: 'writing' },
    filters: { type: ['writing'], tag: ['personal'] },
    sort: { date: '2026-01-04T00:00:00.000Z' },
  });
});

test('toPagefindRecord omits empty tags and the sort key for undated items', () => {
  const record = toPagefindRecord({
    ...item,
    tags: [],
    published: UNDATED,
    type: 'page',
  });
  assert.deepEqual(record.filters, { type: ['page'] });
  assert.ok(!('sort' in record));
});
