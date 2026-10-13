import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Pool } from 'pg';

import { sealMusic, unsealMusic } from '../../lib/music/spotify/credentials';
import { beginSpotify, completeSpotify } from '../../lib/music/spotify/oauth';
import { accessToken } from '../../lib/music/spotify/tokens';
import { getStudioPool } from '../../lib/studio/store';

test('Music credentials never fall back to the writing encryption key', () => {
  const previousMusic = process.env.MUSIC_TOKEN_ENCRYPTION_KEY;
  const previousStudio = process.env.STUDIO_TOKEN_ENCRYPTION_KEY;
  try {
    process.env.STUDIO_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString(
      'base64'
    );
    process.env.MUSIC_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString(
      'base64'
    );
    const sealed = sealMusic({ refreshToken: 'private' });
    assert.deepEqual(unsealMusic(sealed), { refreshToken: 'private' });
    delete process.env.MUSIC_TOKEN_ENCRYPTION_KEY;
    assert.throws(() => sealMusic({}), /Music token encryption/);
    assert.throws(() => unsealMusic(sealed), /Music token encryption/);
    process.env.MUSIC_TOKEN_ENCRYPTION_KEY =
      process.env.STUDIO_TOKEN_ENCRYPTION_KEY;
    assert.throws(() => unsealMusic(sealed), /Reconnect Spotify/);
  } finally {
    if (previousMusic === undefined)
      delete process.env.MUSIC_TOKEN_ENCRYPTION_KEY;
    else process.env.MUSIC_TOKEN_ENCRYPTION_KEY = previousMusic;
    if (previousStudio === undefined)
      delete process.env.STUDIO_TOKEN_ENCRYPTION_KEY;
    else process.env.STUDIO_TOKEN_ENCRYPTION_KEY = previousStudio;
  }
});

test(
  'OAuth binds one-use state to the owner, preserves cancellation, and serializes refresh',
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async () => {
    const schema = 'music_oauth_' + randomUUID().replaceAll('-', '');
    const admin = new Pool({
      connectionString: process.env.STUDIO_TEST_DATABASE_URL,
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.STUDIO_TEST_DATABASE_URL!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.STUDIO_DATABASE_URL = url.href;
    process.env.SPOTIFY_CLIENT_ID = 'test-app';
    process.env.STUDIO_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString(
      'base64'
    );
    process.env.MUSIC_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString(
      'base64'
    );
    process.env.STUDIO_ORIGIN = 'https://preview.willie.page';
    const pool = getStudioPool(),
      originalFetch = globalThis.fetch;
    let exchanges = 0;
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      if (String(input).includes('/api/token')) {
        exchanges++;
        return Response.json({
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        });
      }
      return Response.json({ id: 'willie' });
    }) as typeof fetch;
    try {
      await pool.query(
        await readFile('lib/music/migrations/private.sql', 'utf8')
      );
      const start = await beginSpotify('Owner@example.com');
      const auth = new URL(start.url);
      assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
      assert.equal(
        auth.searchParams.get('redirect_uri'),
        'https://preview.willie.page/api/studio/music/spotify/callback'
      );
      const params = new URLSearchParams({ state: start.state, code: 'code' });
      await assert.rejects(
        completeSpotify('owner@example.com', params, 'wrong'),
        /expired/
      );
      await assert.rejects(
        completeSpotify('other@example.com', params, start.state),
        /expired/
      );
      assert.equal(exchanges, 0);
      await completeSpotify('owner@example.com', params, start.state);
      assert.equal(exchanges, 1);
      await assert.rejects(
        completeSpotify('owner@example.com', params, start.state),
        /already used/
      );
      const sealed = (
        await pool.query('SELECT encrypted_grant FROM music_connections')
      ).rows[0].encrypted_grant;
      assert.ok(!sealed.includes('refresh'));
      const cancelled = await beginSpotify('owner@example.com');
      await assert.rejects(
        completeSpotify(
          'owner@example.com',
          new URLSearchParams({
            state: cancelled.state,
            error: 'access_denied',
          }),
          cancelled.state
        ),
        /cancelled/
      );
      assert.equal(
        (await pool.query('SELECT encrypted_grant FROM music_connections'))
          .rows[0].encrypted_grant,
        sealed
      );
      const grant = unsealMusic<{
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
        authorizedAt: number;
      }>(sealed);
      await pool.query('UPDATE music_connections SET encrypted_grant=$1', [
        sealMusic({ ...grant, expiresAt: 0 }),
      ]);
      await Promise.all([accessToken(), accessToken()]);
      assert.equal(exchanges, 2);
      await pool.query('UPDATE music_connections SET encrypted_grant=$1', [
        sealMusic({ ...grant, expiresAt: 0 }),
      ]);
      globalThis.fetch = (async () =>
        Response.json(
          { error: 'invalid_grant' },
          { status: 400 }
        )) as typeof fetch;
      await assert.rejects(accessToken(), /Reconnect/);
      assert.equal(
        (await pool.query('SELECT reconnect FROM music_connections')).rows[0]
          .reconnect,
        true
      );
    } finally {
      globalThis.fetch = originalFetch;
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);
