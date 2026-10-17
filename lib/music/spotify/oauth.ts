import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { studioOrigin } from '../../studio/config';
import { StudioError } from '../../studio/errors';
import { musicStore } from '../store';
import { SpotifyClient } from './client';
import { sealMusic, spotifyClientId, unsealMusic } from './credentials';
import { exchangeToken } from './tokens';

const callbackUrl = () => `${studioOrigin()}/api/studio/music/spotify/callback`;
export async function beginSpotify(ownerEmail: string) {
  const state = randomBytes(32).toString('base64url'),
    verifier = randomBytes(64).toString('base64url');
  await musicStore().pool.query(
    'DELETE FROM music_oauth_states WHERE expires_at < now()'
  );
  await musicStore().pool.query(
    "INSERT INTO music_oauth_states(state_hash,owner_email,verifier,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",
    [
      createHash('sha256').update(state).digest('hex'),
      ownerEmail.toLowerCase(),
      sealMusic(verifier),
    ]
  );
  const url = new URL('https://accounts.spotify.com/authorize');
  Object.entries({
    client_id: spotifyClientId(),
    response_type: 'code',
    redirect_uri: callbackUrl(),
    scope: 'playlist-read-private',
    state,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  return { url: url.href, state };
}
export async function completeSpotify(
  ownerEmail: string,
  params: URLSearchParams,
  cookieState: string | null
) {
  const state = spotifyCallbackState(params, cookieState);
  const row = (
    await musicStore().pool.query(
      'DELETE FROM music_oauth_states WHERE state_hash=$1 AND owner_email=$2 AND expires_at>now() RETURNING verifier',
      [
        createHash('sha256').update(state).digest('hex'),
        ownerEmail.toLowerCase(),
      ]
    )
  ).rows[0];
  if (row == null)
    throw new StudioError(
      400,
      'Spotify sign-in expired or was already used. Connect again.'
    );
  if (params.has('error'))
    throw new StudioError(
      400,
      'Spotify connection was cancelled. Your previous connection and draft are unchanged.'
    );
  const code = params.get('code');
  if (!code)
    throw new StudioError(400, 'Spotify did not return an authorization code.');
  const grant = await exchangeToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(),
    code_verifier: unsealMusic<string>(row.verifier),
  });
  const me = await new SpotifyClient(grant.accessToken).get('me');
  if (typeof me.id !== 'string' || !me.id)
    throw new StudioError(
      502,
      'Spotify did not identify the connected account.'
    );
  const db = await musicStore().pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('music-connect'))");
    const existing = (
      await db.query(
        'SELECT owner_id FROM music_connections WHERE singleton=true'
      )
    ).rows[0];
    if (existing != null && existing.owner_id !== me.id)
      throw new StudioError(
        409,
        'Reconnect the same Spotify account to preserve your collection.'
      );
    await db.query(
      'INSERT INTO music_connections(singleton,owner_id,encrypted_grant) VALUES(true,$1,$2) ON CONFLICT(singleton) DO UPDATE SET encrypted_grant=excluded.encrypted_grant,reconnect=false,updated_at=now()',
      [me.id, sealMusic(grant)]
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.release();
  }
}

function spotifyCallbackState(
  params: URLSearchParams,
  cookieState: string | null
) {
  const state = params.get('state');
  if (
    !state ||
    !cookieState ||
    state.length !== cookieState.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))
  )
    throw new StudioError(400, 'Spotify sign-in expired. Connect again.');
  return state;
}
