import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalRepostActors } from '@/lib/atproto/responses/observations';

test('repost observation cache keys ignore AppView order and duplicate actors', () => {
  assert.deepEqual(
    canonicalRepostActors(['did:plc:b', 'did:plc:a', 'did:plc:b']),
    ['did:plc:a', 'did:plc:b']
  );
  assert.deepEqual(canonicalRepostActors(['did:plc:a', 'did:plc:b']), [
    'did:plc:a',
    'did:plc:b',
  ]);
});
