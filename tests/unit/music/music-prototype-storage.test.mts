import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MUSIC_PROTOTYPE_STORAGE_KEY,
  readPrototypeCatalog,
} from '../../../components/music/music-prototype-storage';
import { parseCatalog } from '../../../lib/music/schema';
import { type MusicCatalog, emptyCatalog } from '../../../lib/music/types';

function validCatalog(value: unknown): value is MusicCatalog {
  try {
    parseCatalog(value);
    return true;
  } catch {
    return false;
  }
}

function storage(value: string | null) {
  return {
    getItem(key: string) {
      assert.equal(key, MUSIC_PROTOTYPE_STORAGE_KEY);
      return value;
    },
  };
}

test('prototype recovery retains distinct live and draft documents without normalizing them', () => {
  const live = emptyCatalog;
  const id = '1'.repeat(22);
  const draft = {
    ...emptyCatalog,
    order: [id],
    selected: [id],
    lead: id,
    notes: { [id]: '  Authored note.\n' },
  };
  assert.deepEqual(
    readPrototypeCatalog(
      storage(JSON.stringify({ live, draft })),
      validCatalog
    ),
    { live, draft }
  );
});

test('recovery requires both documents to validate and never partially restores one', () => {
  const checked: unknown[] = [];
  const validate = (value: unknown): value is MusicCatalog => {
    checked.push(value);
    return validCatalog(value);
  };
  assert.equal(
    readPrototypeCatalog(
      storage(JSON.stringify({ live: emptyCatalog, draft: { version: 2 } })),
      validate
    ),
    null
  );
  assert.deepEqual(checked, [emptyCatalog, { version: 2 }]);
  checked.length = 0;
  assert.equal(
    readPrototypeCatalog(
      storage(JSON.stringify({ live: { version: 2 }, draft: emptyCatalog })),
      validate
    ),
    null
  );
  assert.deepEqual(checked, [{ version: 2 }]);
});

test('absent storage or validator restores nothing and malformed storage stays an owner-visible error', () => {
  assert.equal(readPrototypeCatalog(storage(null), validCatalog), null);
  assert.equal(
    readPrototypeCatalog(
      storage(JSON.stringify({ live: emptyCatalog, draft: emptyCatalog }))
    ),
    null
  );
  assert.throws(
    () => readPrototypeCatalog(storage('{'), validCatalog),
    SyntaxError
  );
  const failure = new Error('Browser storage blocked');
  assert.throws(
    () =>
      readPrototypeCatalog(
        {
          getItem: () => {
            throw failure;
          },
        },
        validCatalog
      ),
    (error) => error === failure
  );
});
