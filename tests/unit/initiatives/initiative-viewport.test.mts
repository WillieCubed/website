import assert from 'node:assert/strict';
import test from 'node:test';

import { viewportForBrand } from '@/lib/initiatives/viewport';

test('viewportForBrand uses a #rrggbb brand as the theme colour', () => {
  assert.deepEqual(viewportForBrand('#ef8f2b'), { themeColor: '#ef8f2b' });
});

test('viewportForBrand leaves the site colour for a seed key or no brand', () => {
  assert.deepEqual(viewportForBrand('lvbt'), {});
  assert.deepEqual(viewportForBrand('#abc'), {});
  assert.deepEqual(viewportForBrand(undefined), {});
});
