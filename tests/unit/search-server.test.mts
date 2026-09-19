import assert from 'node:assert/strict';
import test from 'node:test';

import { rankItems } from '@/lib/search/rank';
import { searchContent, selectSearchable } from '@/lib/search/server';
import { type SearchableItem, UNDATED } from '@/lib/search/types';

const base = { description: '', content: '', tags: [], published: UNDATED };
const items: SearchableItem[] = [
  {
    ...base,
    slug: 'hello',
    path: '/writings/hello',
    title: 'Hello',
    type: 'writing',
  },
  {
    ...base,
    slug: 'initiatives/twd',
    path: '/initiatives/twd',
    title: 'The Willie Diaries',
    type: 'initiative',
  },
  {
    ...base,
    slug: 'pages/writings',
    path: '/writings',
    title: 'Writings',
    type: 'page',
  },
  {
    ...base,
    slug: 'greenhouse',
    path: '/projects/greenhouse',
    title: 'Greenhouse',
    type: 'project',
  },
];

test('selectSearchable never returns projects', () => {
  assert.deepEqual(
    selectSearchable(items, 'all').map((item) => item.slug),
    ['hello', 'initiatives/twd', 'pages/writings']
  );
});

test('selectSearchable narrows to one type', () => {
  assert.deepEqual(
    selectSearchable(items, 'initiative').map((item) => item.slug),
    ['initiatives/twd']
  );
});

test('rankItems keeps the path of an initiative result', () => {
  const [result] = rankItems(items, 'diaries');
  assert.equal(result.path, '/initiatives/twd');
});

test('searchContent returns nothing in hiatus mode', async () => {
  const before = process.env.SITE_MODE;
  process.env.SITE_MODE = 'hiatus';
  try {
    const response = await searchContent('writings');
    assert.equal(response.total, 0);
    assert.deepEqual(response.results, []);
  } finally {
    if (before === undefined) delete process.env.SITE_MODE;
    else process.env.SITE_MODE = before;
  }
});
