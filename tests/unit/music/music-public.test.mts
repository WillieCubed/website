import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cacheApproved, publicMusicPool } from '../../../lib/music/public';
import { visibleCollection } from '../../../lib/music/public-projection';
import { type MusicPlaylist, emptyCatalog } from '../../../lib/music/types';

const a = '0123456789012345678901',
  b = '0123456789012345678902',
  c = '0123456789012345678903',
  now = Date.parse('2026-10-13T12:00:00Z');
const make = (
  id: string,
  changes: Partial<MusicPlaylist> = {}
): MusicPlaylist => ({
  id,
  title: id,
  description: '',
  image: null,
  url: `https://open.spotify.com/playlist/${id}`,
  ownerId: 'owner',
  eligible: true,
  snapshot: 'v1',
  tracks: [],
  trackCount: 0,
  checkedAt: '2026-10-13T11:00:00Z',
  error: null,
  ...changes,
});
test('public reads suppress excluded, newly private, and expired cache records including series and notes', () => {
  const result = visibleCollection(
    {
      ...emptyCatalog,
      order: [a, b, c],
      selected: [a, b],
      lead: b,
      notes: { [a]: 'Public', [b]: 'Hidden', [c]: 'Private' },
      series: [{ id: 'fall', title: 'Fall', playlistIds: [a, b, c] }],
    },
    [make(a), make(b, { eligible: false }), make(c)],
    now
  );
  assert.deepEqual(
    result.playlists.map((p) => p.id),
    [a]
  );
  assert.equal(result.catalog.lead, null);
  assert.deepEqual(result.catalog.notes, { [a]: 'Public' });
  assert.deepEqual(result.catalog.series[0].playlistIds, [a]);
  assert.equal(
    visibleCollection(
      { ...emptyCatalog, order: [a], selected: [a] },
      [make(a, { checkedAt: '2026-10-12T11:59:59Z' })],
      now
    ).playlists.length,
    0
  );
});

test('public Music refuses unscoped read and write connections', async () => {
  const previous = process.env.MUSIC_PUBLIC_DATABASE_URL;
  const previousWriter = process.env.MUSIC_CACHE_WRITE_DATABASE_URL;
  delete process.env.MUSIC_PUBLIC_DATABASE_URL;
  delete process.env.MUSIC_CACHE_WRITE_DATABASE_URL;
  try {
    assert.throws(
      publicMusicPool,
      /MUSIC_PUBLIC_DATABASE_URL is not configured/
    );
    await assert.rejects(
      cacheApproved([make(a)]),
      /Music publication storage is not configured/
    );
  } finally {
    if (previous) process.env.MUSIC_PUBLIC_DATABASE_URL = previous;
    if (previousWriter)
      process.env.MUSIC_CACHE_WRITE_DATABASE_URL = previousWriter;
  }
});

test('missing or expired approved content is unavailable, while known exclusions are empty', () => {
  const catalog = { ...emptyCatalog, order: [a, b], selected: [a, b] };
  assert.equal(visibleCollection(catalog, [], now).unavailable, true);
  assert.equal(
    visibleCollection(catalog, [make(a, { eligible: false })], now).unavailable,
    true
  );
  assert.equal(
    visibleCollection(
      catalog,
      [
        make(a, { checkedAt: '2026-10-12T11:00:00Z' }),
        make(b, { eligible: false }),
      ],
      now
    ).unavailable,
    true
  );
  assert.equal(
    visibleCollection(
      catalog,
      [make(a, { eligible: false }), make(b, { eligible: false })],
      now
    ).unavailable,
    false
  );
  assert.equal(visibleCollection(emptyCatalog, [], now).unavailable, false);
  assert.equal(visibleCollection(catalog, [make(a)], now).unavailable, false);
});
