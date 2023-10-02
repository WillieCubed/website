import crypto from 'node:crypto';

// TODO: Fix this obviously, OBVIOUSLY bad excuse of security
export const spotify_state_code = '10'; // A "random" number
export const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
export const SPOTIFY_API_BASE_URI = 'https://api.spotify.com/v1';
export const SPOTIFY_REDIRECT_URI =
  process.env.NODE_ENV === 'production'
    ? 'https://williecubed.me/api/spotify-callback/'
    : 'http://localhost:3000/api/spotify-callback/';

const MIN_BYTES_LENGTH = 43 * 2;
const MAX_BYTES_LENGTH = 128 * 2;

/**
 * Generates a code verifier for PKCE.
 *
 * @param bytesLength A fixed value at between 43 and 128.
 * @returns a randomly generated
 * @see https://developer.spotify.com/documentation/general/guides/authorization/code-flow/
 */
function createCodeVerifier(characters = MIN_BYTES_LENGTH / 2) {
  // TODO: Optimize unnecessary multiplication/division
  // bytesLength should be at least 43 * 2 bytes in length.
  const bytesLength = characters * 2;
  if (bytesLength < MIN_BYTES_LENGTH) {
    throw new Error('bytesLength must be at least 43 * 2.');
  }
  if (bytesLength > MAX_BYTES_LENGTH) {
    throw new Error('bytesLength must be less than 128 * 2.');
  }
  return crypto.randomBytes(bytesLength).toString('hex');
}

export const TEST_CODE_VERIFIER = '88';

export async function generateCodeChallenge() {
  // const codeVerifier = createCodeVerifier();
  const codeVerifier = TEST_CODE_VERIFIER;
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const decoder = new TextDecoder();
  const challenge = decoder.decode(hash);
  return challenge;
}
