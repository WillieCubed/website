import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCatalog, publicCatalog } from '../../../lib/music/schema';
import type { MusicCatalog } from '../../../lib/music/types';

const a = '0123456789012345678901',
  b = '0123456789012345678902';
const catalog: MusicCatalog = {
  version: 1,
  order: [a, b],
  selected: [a],
  lead: a,
  notes: { [a]: 'Listen in order', [b]: 'Private note' },
  series: [{ id: 'fall-tour', title: 'Fall Tour', playlistIds: [b, a] }],
};
test('catalog rejects invalid membership and accidental fields instead of dropping them', () => {
  for (const value of [
    { ...catalog, selected: [a, a] },
    { ...catalog, lead: b },
    { ...catalog, order: [a] },
    { ...catalog, token: 'secret' },
    { ...catalog, series: [{ id: 'x', title: 'X', playlistIds: ['fall-1'] }] },
  ])
    assert.throws(() => parseCatalog(value, [a, b]));
  assert.deepEqual(parseCatalog(catalog, [a, b]), catalog);
});
test('public projection retains the chosen order but removes excluded identifiers and notes', () => {
  assert.deepEqual(publicCatalog(catalog), {
    version: 1,
    order: [a],
    selected: [a],
    lead: a,
    notes: { [a]: 'Listen in order' },
    series: [{ id: 'fall-tour', title: 'Fall Tour', playlistIds: [a] }],
  });
});
