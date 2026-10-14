import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SpotifyClient, SpotifyError } from '../../../lib/music/spotify/client';
import { importPlaylist } from '../../../lib/music/spotify/import';
import { exchangeToken } from '../../../lib/music/spotify/tokens';

const id = '0123456789012345678901';
test('provider pagination never sends a bearer credential to a foreign next URL', async () => {
  const request = (async () =>
    Response.json({
      items: [],
      next: 'https://evil.test/steal',
    })) as typeof fetch;
  await assert.rejects(
    new SpotifyClient('private', request).pages('me/playlists'),
    /destination/
  );
});
test('provider exposes Retry-After without looping under a rate limit', async () => {
  const request = (async () =>
    new Response('', {
      status: 429,
      headers: { 'Retry-After': '120' },
    })) as typeof fetch;
  await assert.rejects(
    new SpotifyClient('private', request).get('me'),
    (e) => e instanceof SpotifyError && e.retryAfter === 120
  );
});
test('a snapshot change discards the mixed sequence and imports the new sequence', async () => {
  let metadata = 0;
  const request = (async (input: URL | RequestInfo) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/items'))
      return Response.json({
        items: [
          {
            item: {
              name: metadata < 2 ? 'Old' : 'New',
              type: 'track',
              duration_ms: 1000,
            },
          },
        ],
        next: null,
      });
    metadata++;
    return Response.json({
      id,
      name: 'Ordered',
      public: true,
      owner: { id: 'willie' },
      snapshot_id: metadata === 1 ? 'old' : 'new',
      items: { total: 1 },
    });
  }) as typeof fetch;
  const result = await importPlaylist(
    new SpotifyClient('private', request),
    id,
    'willie'
  );
  assert.equal(result.snapshot, 'new');
  assert.equal(result.tracks[0].title, 'New');
  assert.equal(metadata, 4);
});
test('refresh retains the prior refresh token and authorization date when Spotify omits replacement', async () => {
  const oldId = process.env.SPOTIFY_CLIENT_ID;
  process.env.SPOTIFY_CLIENT_ID = 'app';
  try {
    const grant = await exchangeToken(
      { grant_type: 'refresh_token', refresh_token: 'old' },
      {
        accessToken: 'expired',
        refreshToken: 'old',
        expiresAt: 0,
        authorizedAt: 123,
      },
      (async () =>
        Response.json({
          access_token: 'new',
          expires_in: 3600,
        })) as typeof fetch
    );
    assert.equal(grant.refreshToken, 'old');
    assert.equal(grant.authorizedAt, 123);
    assert.equal(grant.accessToken, 'new');
  } finally {
    if (oldId) process.env.SPOTIFY_CLIENT_ID = oldId;
    else delete process.env.SPOTIFY_CLIENT_ID;
  }
});
