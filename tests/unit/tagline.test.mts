import assert from 'node:assert/strict';
import test from 'node:test';

import { taglineHref } from '@/lib/enhancements';
import taglines from '@/lib/tagline_data.json';

test('exactly one tagline links to /coffee, the teapot one', () => {
  const linked = taglines.filter(
    (tagline) => taglineHref(tagline) === '/coffee'
  );

  assert.equal(linked.length, 1);
  assert.match(linked[0], /^418 /);
});

test('other taglines are plain text', () => {
  assert.equal(taglineHref("Glad you're here."), undefined);
});
