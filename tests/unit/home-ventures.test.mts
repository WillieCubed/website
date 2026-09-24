import assert from 'node:assert/strict';
import test from 'node:test';

import { entries, getHomeTiles, ventures } from '@/lib/home/ventures';

const hidden = ventures.filter((v) => v.hidden).map((v) => v.id);

test('Atlas keeps its record but is marked hidden', () => {
  const atlas = ventures.find((v) => v.id === 'atlas');
  assert.ok(atlas, 'the Atlas entry is still in the data');
  assert.equal(atlas.hidden, true);
});

test('a hidden venture gets no tile or detail view', () => {
  const tiles = getHomeTiles().map((tile) => tile.id);
  for (const id of hidden) {
    assert.ok(!tiles.includes(id), `${id} has no tile`);
    assert.equal(entries[id], undefined, `${id} has no detail view`);
  }
});

test('every venture not marked hidden still gets a tile', () => {
  const tiles = getHomeTiles().map((tile) => tile.id);
  for (const venture of ventures.filter((v) => !v.hidden)) {
    assert.ok(tiles.includes(venture.id), `${venture.id} has a tile`);
    assert.ok(entries[venture.id], `${venture.id} opens a detail view`);
  }
});
