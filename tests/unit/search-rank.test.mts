import assert from 'node:assert/strict';
import test from 'node:test';

import { rankItems, tokenize } from '@/lib/search/rank';
import type { SearchableItem } from '@/lib/search/types';

const items: SearchableItem[] = [
  {
    slug: 'fall-tour-2026-begins',
    path: '/writings/fall-tour-2026-begins',
    title: 'Fall Tour 2026 starts today.',
    description: 'Fall Tour 2026 starts today.',
    content: 'Fall Tour 2026 starts today. I am packing the car.',
    tags: ['note', 'fall-tour-2026'],
    published: '2026-09-18T15:00:00.000Z',
    type: 'writing',
  },
  {
    slug: 'project-superbloom',
    path: '/writings/project-superbloom',
    title: 'Project Superbloom',
    description: 'Four products in one month.',
    content: 'A rare desert phenomenon. Nothing about touring here.',
    tags: ['projects'],
    published: '2026-05-01T00:00:00.000Z',
    type: 'writing',
  },
];

test('tokenize lowercases, dedupes, and drops one-character terms', () => {
  assert.deepEqual(tokenize('Fall fall a Tour!'), ['fall', 'tour']);
});

test('rankItems requires every term and prefers title matches', () => {
  const results = rankItems(items, 'fall');
  assert.equal(results.length, 1);
  assert.equal(results[0].slug, 'fall-tour-2026-begins');
  assert.ok(results[0].snippet?.includes('Fall Tour 2026'));

  assert.equal(rankItems(items, 'fall superbloom').length, 0);
  assert.equal(rankItems(items, 'desert')[0].slug, 'project-superbloom');
});
