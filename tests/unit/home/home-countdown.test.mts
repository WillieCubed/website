import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { readStylesheet } from '../../support/theme/styles.mts';

test('countdown caption styles skip the span CountUp renders inside the number', async () => {
  const css = await readStylesheet(
    path.join(process.cwd(), 'components/home/home.css')
  );
  // `.count span` would also match `<b><span>132</span></b>` and shrink the
  // number to caption size; only the caption is a direct child.
  assert.deepEqual(css.match(/\.(?:d-)?count\s+span\b/g), null);
  assert.match(css, /\.count > span\b/);
  assert.match(css, /\.d-count > span\b/);
});
