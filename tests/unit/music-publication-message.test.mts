import assert from 'node:assert/strict';
import { test } from 'node:test';

import { musicPublicationMessage } from '../../lib/music/publication-message';
import { type MusicCatalog, emptyCatalog } from '../../lib/music/types';

const a = 'a'.repeat(22),
  b = 'b'.repeat(22),
  hidden = 'h'.repeat(22);
const titles = [
  { id: a, title: 'Fall Tour 2026, Part 1' },
  { id: b, title: 'Late hours' },
];
const revision = '77777777-7777-4777-8777-777777777777';
const base: MusicCatalog = { ...emptyCatalog, order: [a, b], selected: [a, b] };

test('publication commits name the changed feature and keep recovery IDs in the body', () => {
  const result = musicPublicationMessage(
    base,
    { ...base, lead: a },
    titles,
    revision
  );
  assert.equal(result.title, 'feat(music): Feature Fall Tour 2026, Part 1');
  assert.match(result.message, /Featured playlist: Fall Tour 2026, Part 1/);
  assert.match(result.message, new RegExp(`Music-Revision: ${revision}`));
  assert.ok(!result.title.includes(revision));
});

test('publication summaries describe membership, sequence, notes, and series without private edits', () => {
  const before: MusicCatalog = {
    ...base,
    order: [a, b, hidden],
    selected: [a],
    notes: { [hidden]: 'Private draft' },
  };
  const after: MusicCatalog = {
    ...base,
    order: [b, a, hidden],
    notes: { [a]: 'Listen in order.', [hidden]: 'Secret' },
    series: [{ id: 'tour', title: 'Fall Tour', playlistIds: [a] }],
  };
  const result = musicPublicationMessage(
    before,
    after,
    [...titles, { id: hidden, title: 'Private playlist' }],
    revision
  );
  assert.equal(
    result.title,
    'feat(music): Add Late hours to the music gallery'
  );
  assert.match(result.message, /Added: Late hours/);
  assert.match(result.message, /notes: Fall Tour 2026, Part 1/);
  assert.match(result.message, /Added series: Fall Tour/);
  assert.doesNotMatch(result.message, /Private|Secret|hhhhhh/);
});

test('removing the feature and reordering a series produce distinct human titles', () => {
  assert.equal(
    musicPublicationMessage({ ...base, lead: a }, base, titles, revision).title,
    'feat(music): Remove the featured playlist'
  );
  const before = {
    ...base,
    series: [{ id: 'tour', title: 'Fall Tour', playlistIds: [a, b] }],
  };
  const after = {
    ...base,
    series: [{ id: 'tour', title: 'Fall Tour', playlistIds: [b, a] }],
  };
  const result = musicPublicationMessage(before, after, titles, revision);
  assert.equal(result.title, 'feat(music): Update the Fall Tour series');
  assert.match(
    result.message,
    /Series order \(Fall Tour\): Late hours → Fall Tour 2026, Part 1/
  );
});

test('provider titles cannot introduce extra commit headers and long titles stay readable', () => {
  const result = musicPublicationMessage(
    emptyCatalog,
    { ...base, selected: [a] },
    [{ id: a, title: 'Very long '.repeat(20) + '\n\nFake-Trailer: yes' }],
    revision
  );
  assert.ok(result.title.length <= 80);
  assert.ok(!result.title.includes('\n'));
  assert.doesNotMatch(result.message, /\nFake-Trailer:/);
});

test('the first public selection names the gallery publication', () => {
  const result = musicPublicationMessage(emptyCatalog, base, titles, revision);
  assert.equal(
    result.title,
    'feat(music): Publish 2 playlists to the music gallery'
  );
  assert.match(result.message, /Added: Fall Tour 2026, Part 1, Late hours/);
});
