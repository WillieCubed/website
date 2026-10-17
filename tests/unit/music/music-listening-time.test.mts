import assert from 'node:assert/strict';
import { test } from 'node:test';

import { listeningTime } from '../../../lib/music/presentation.ts';

test('listening time counts repeated tracks and formats hours', () => {
  assert.equal(
    listeningTime([{ duration: '32:12' }, { duration: '32:12' }]),
    '1 hr 4 min'
  );
});

test('missing durations produce an explicit lower bound', () => {
  assert.equal(
    listeningTime([{ duration: '4:12' }, { duration: '—' }]),
    '4+ min'
  );
  assert.equal(listeningTime([{ duration: '—' }]), null);
  assert.equal(listeningTime([]), null);
});
