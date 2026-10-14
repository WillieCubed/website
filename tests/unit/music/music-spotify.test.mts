import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizePlaylist,
  normalizeTrack,
} from '../../../lib/music/spotify/normalize';

const song = {
  type: 'track',
  id: '0123456789012345678901',
  name: 'One',
  duration_ms: 252000,
  artists: [{ name: 'Artist' }],
  external_urls: {
    spotify: 'https://open.spotify.com/track/0123456789012345678901',
  },
};
test('Spotify current item envelopes preserve duplicate, null, local and episode positions', () => {
  const tracks = [
    { item: song },
    { item: null },
    { is_local: true, item: { ...song, is_local: true } },
    {
      item: {
        type: 'episode',
        name: 'Episode',
        duration_ms: 61000,
        show: { name: 'Show' },
      },
    },
    { item: song },
  ].map(normalizeTrack);
  assert.deepEqual(
    tracks.map((t) => t.kind),
    ['track', 'unavailable', 'local', 'episode', 'track']
  );
  assert.equal(tracks[0].duration, '4:12');
  assert.equal(tracks[1].durationMs, null);
  assert.deepEqual(tracks[0], tracks[4]);
  assert.equal(tracks[3].artist, 'Show');
});
test('only an explicitly public playlist owned by the connected account is eligible', () => {
  const raw = {
    id: song.id,
    name: 'Compilation',
    owner: { id: 'willie' },
    public: true,
    snapshot_id: 'v1',
    images: [{ url: 'https://i.scdn.co/image/abc' }],
    items: { total: 3 },
  };
  assert.equal(
    normalizePlaylist(raw, 'willie', [], '2026-10-13T00:00:00Z').eligible,
    true
  );
  for (const changes of [
    { public: false },
    { public: null },
    { owner: { id: 'other' } },
  ])
    assert.equal(
      normalizePlaylist(
        { ...raw, ...changes },
        'willie',
        [],
        '2026-10-13T00:00:00Z'
      ).eligible,
      false
    );
  assert.equal(
    normalizePlaylist(
      { ...raw, images: [{ url: 'https://evil.test/cover' }] },
      'willie',
      [],
      '2026-10-13T00:00:00Z'
    ).image,
    null
  );
});
