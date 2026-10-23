import assert from 'node:assert/strict';
import test from 'node:test';

import * as featured from '@/lib/home/featured';
import * as initiatives from '@/lib/initiatives/index';
import { loadAllInitiatives } from '@/lib/initiatives/load';

test('homepage tiles and playbills derive from the same visible initiative snapshot', () => {
  assert.equal(typeof featured.featuredTiles, 'function');
  assert.equal(typeof initiatives.featuredInitiatives, 'function');
  const snapshot = loadAllInitiatives({
    now: new Date('2026-10-23T12:00:00Z'),
  });
  const before = snapshot.map((item) => item.slug);
  const selected = initiatives.featuredInitiatives(snapshot);
  const tiles = featured.featuredTiles(snapshot);
  assert.deepEqual(
    tiles.map((tile) => tile.id),
    selected.map((item) => `initiative-${item.slug}`)
  );
  assert.deepEqual(
    snapshot.map((item) => item.slug),
    before
  );
  for (const tile of tiles) {
    const item = snapshot.find(
      (item) => tile.id === `initiative-${item.slug}`
    )!;
    assert.equal(
      tile.parent,
      snapshot.find((parent) => parent.slug === item.parent)?.title
    );
    assert.equal(tile.href, item.href);
    assert.equal(tile.body, item.parts.length > 0 ? 'playbill' : 'cover');
  }
});
