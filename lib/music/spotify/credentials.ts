import { sealJson, unsealJson } from '../../crypto/sealed-json';
import { StudioError } from '../../studio/errors';

export function spotifyClientId(): string {
  const id = process.env.SPOTIFY_CLIENT_ID;
  if (!id) throw new StudioError(503, 'Spotify client is not configured.');
  return id;
}

function musicKey(): string {
  const key = process.env.MUSIC_TOKEN_ENCRYPTION_KEY;
  if (!key || Buffer.from(key, 'base64').length !== 32)
    throw new StudioError(503, 'Music token encryption is not configured.');
  return key;
}

export function sealMusic(value: unknown): string {
  return sealJson(value, musicKey());
}

export function unsealMusic<T>(value: string): T {
  const key = musicKey();
  try {
    return unsealJson<T>(value, key);
  } catch {
    throw new StudioError(401, 'Reconnect Spotify to continue.');
  }
}
