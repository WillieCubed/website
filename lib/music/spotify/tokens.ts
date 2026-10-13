import { StudioError } from '../../studio/errors';
import { required, seal, unseal } from '../../studio/oauth';
import { musicStore } from '../store';
import { SpotifyError } from './client';

export interface SpotifyGrant {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  authorizedAt: number;
}
export async function exchangeToken(
  fields: Record<string, string>,
  old?: SpotifyGrant,
  request: typeof fetch = fetch
): Promise<SpotifyGrant> {
  const response = await request('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...fields,
      client_id: required('SPOTIFY_CLIENT_ID'),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error.error === 'invalid_grant')
      throw new StudioError(401, 'Reconnect Spotify to continue.');
    throw new SpotifyError(
      response.status,
      response.status === 429
        ? Number(response.headers.get('retry-after')) || 60
        : null
    );
  }
  const result = await response.json();
  if (
    typeof result.access_token !== 'string' ||
    !(result.refresh_token ?? old?.refreshToken) ||
    !Number.isFinite(result.expires_in)
  )
    throw new StudioError(502, 'Spotify returned an incomplete authorization.');
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token ?? old!.refreshToken,
    expiresAt: Date.now() + Number(result.expires_in) * 1000,
    authorizedAt: old?.authorizedAt ?? Date.now(),
  };
}
export async function accessToken(): Promise<{
  token: string;
  ownerId: string;
}> {
  const client = await musicStore().pool.connect();
  try {
    await client.query('BEGIN');
    const row = (
      await client.query(
        'SELECT * FROM music_connections WHERE singleton=true FOR UPDATE'
      )
    ).rows[0];
    if (!row || row.reconnect)
      throw new StudioError(401, 'Connect Spotify to import your playlists.');
    let grant = unseal<SpotifyGrant>(
      row.encrypted_grant,
      process.env.MUSIC_TOKEN_ENCRYPTION_KEY
    );
    if (grant.expiresAt < Date.now() + 60000) {
      try {
        grant = await exchangeToken(
          { grant_type: 'refresh_token', refresh_token: grant.refreshToken },
          grant
        );
      } catch (error) {
        if (error instanceof StudioError && error.status === 401) {
          await client.query(
            'UPDATE music_connections SET reconnect=true WHERE singleton=true'
          );
          await client.query('COMMIT');
        }
        throw error;
      }
      await client.query(
        'UPDATE music_connections SET encrypted_grant=$1,updated_at=now() WHERE singleton=true',
        [seal(grant, process.env.MUSIC_TOKEN_ENCRYPTION_KEY)]
      );
    }
    await client.query('COMMIT');
    return { token: grant.accessToken, ownerId: row.owner_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
