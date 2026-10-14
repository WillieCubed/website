import {
  corsPreflight,
  handleUserInfo,
} from '@/lib/indieweb/indieauth/endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth/storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * Return the current profile fields authorized by the bearer access token.
 * Return 401 for a missing or invalid token and 403 when no profile scope is
 * authorized.
 */
export async function GET(request: Request) {
  try {
    return await handleUserInfo(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth user information request failed:', error);
    return jsonError('server_error', 500);
  }
}

/** Return the CORS preflight headers for browser-based profile requests. */
export function OPTIONS() {
  return corsPreflight();
}
