import assert from 'node:assert/strict';
import test from 'node:test';

import { isFacetPressed } from '@/components/home/HomeContext';

test('no facet key is pressed while nothing is previewed', () => {
  assert.equal(isFacetPressed(null, 'software'), false);
});

test('only the previewed facet key is pressed', () => {
  const preview = { facet: 'systems' } as const;
  assert.equal(isFacetPressed(preview, 'systems'), true);
  assert.equal(isFacetPressed(preview, 'software'), false);
  assert.equal(isFacetPressed(preview, 'people'), false);
});

test('previewing an entry lights its facets without pressing their keys', () => {
  assert.equal(isFacetPressed({ id: 'lvbt' }, 'people'), false);
});
