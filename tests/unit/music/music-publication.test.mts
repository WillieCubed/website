import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  matchesMusicProof,
  musicArtifact,
} from '../../../lib/music/publication-artifact';
import { emptyCatalog } from '../../../lib/music/types';

test('publication exports only the approved subset and requires deployed artifact and commit proof', () => {
  const a = 'a'.repeat(22),
    b = 'b'.repeat(22),
    id = '11111111-1111-4111-8111-111111111111';
  const artifact = musicArtifact(id, {
    ...emptyCatalog,
    order: [a, b],
    selected: [a],
    lead: a,
    notes: { [a]: 'Approved', [b]: 'Private' },
    series: [{ id: 'fall', title: 'Fall Tour', playlistIds: [a, b] }],
  });
  assert.equal(artifact.path, 'content/music/catalog.json');
  assert.ok(!artifact.content.includes(b));
  assert.ok(!artifact.content.includes('Private'));
  const publication = {
    revisionId: id,
    sourceSha: artifact.sha,
    commit: 'a'.repeat(40),
  };
  assert.equal(matchesMusicProof(publication, { ...publication }), true);
  assert.equal(
    matchesMusicProof(publication, { ...publication, revisionId: 'other' }),
    false
  );
  assert.equal(
    matchesMusicProof(publication, { ...publication, sourceSha: 'old' }, true),
    false
  );
  assert.equal(
    matchesMusicProof(publication, { ...publication, commit: 'b'.repeat(40) }),
    false
  );
  assert.equal(
    matchesMusicProof(
      publication,
      { ...publication, commit: 'b'.repeat(40) },
      true
    ),
    true
  );
});
