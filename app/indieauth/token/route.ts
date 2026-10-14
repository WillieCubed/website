import {
  corsPreflight,
  handleTokenRequest,
  handleTokenVerification,
} from '@/lib/indieweb/indieauth/endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth/storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * Verify the bearer access token and return its profile URL, client, and
 * scopes for older Micropub clients. Return 401 for an invalid token.
 */
export async function GET(request: Request) {
  try {
    return await handleTokenVerification(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth token verification failed:', error);
    return jsonError('server_error', 500);
  }
}

/**
 * Exchange an authorization code for tokens, rotate a refresh token, or
 * revoke a token with action=revoke. Accept form-encoded OAuth parameters; a
 * sign-in-only grant returns the profile URL without issuing an access
 * token.
 */
export async function POST(request: Request) {
  try {
    return await handleTokenRequest(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth token request failed:', error);
    return jsonError('server_error', 500);
  }
}

/** Return the CORS preflight headers for browser-based token requests. */
export function OPTIONS() {
  return corsPreflight();
}
