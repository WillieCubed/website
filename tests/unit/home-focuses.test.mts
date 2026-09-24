import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { isFocusPressed } from '@/components/home/HomeContext';

import {
  FOCUS_IDS,
  focuses,
  iconPicture,
  tilesByFocus,
} from '@/lib/home/focuses';
import { getHomeTiles, products, ventures } from '@/lib/home/ventures';
import { FeatureSchema } from '@/lib/initiatives/schema';

test('the rail lists every focus once, in order', () => {
  assert.deepEqual(
    focuses.map((focus) => focus.id),
    [...FOCUS_IDS]
  );
});

test('every focus a tile names exists', () => {
  for (const entry of [...ventures, ...Object.values(products)]) {
    for (const focus of entry.focuses) {
      assert.ok(FOCUS_IDS.includes(focus), `${entry.id} names ${focus}`);
    }
  }
});

test('a hidden tile does not make its focus live', () => {
  const tiles = getHomeTiles().map((tile) => ({
    id: tile.id,
    focuses: tile.kind === 'venture' ? tile.venture.focuses : tile.focuses,
  }));
  const byFocus = tilesByFocus(tiles);
  // Atlas is the only work on the helpers focus, and it is hidden.
  assert.deepEqual(byFocus.helpers, []);
  assert.deepEqual(byFocus.cities, ['lvbt', 'transitmapper']);
});

test('a tile can serve no focus', () => {
  assert.deepEqual(products.curfew.focuses, []);
});

test('initiative frontmatter rejects an unknown focus', () => {
  const feature = { weight: 50, hint: 'Look' };
  assert.ok(
    FeatureSchema.safeParse({ ...feature, focuses: ['tools'] }).success
  );
  assert.ok(
    !FeatureSchema.safeParse({ ...feature, focuses: ['people'] }).success
  );
});

test('only the previewed focus row is pressed', () => {
  assert.equal(isFocusPressed(null, 'cities'), false);
  assert.equal(isFocusPressed({ focus: 'cities' }, 'cities'), true);
  assert.equal(isFocusPressed({ focus: 'cities' }, 'tools'), false);
  assert.equal(isFocusPressed({ id: 'lvbt' }, 'cities'), false);
});

test('every focus icon has a file', () => {
  for (const focus of focuses) {
    assert.ok(focus.icons.length > 0, `${focus.id} has an icon`);
    for (const name of focus.icons) {
      const file = join('public', iconPicture(name).src);
      assert.ok(existsSync(file), `${file} exists`);
    }
  }
});
