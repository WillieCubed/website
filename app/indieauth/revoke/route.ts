import {
  corsPreflight,
  handleRevocation,
} from '@/lib/indieweb/indieauth/endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth/storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * Revoke the form token and return an empty success response. Unknown tokens
 * also succeed so callers cannot use this endpoint to test token validity.
 */
export async function POST(request: Request) {
  try {
    return await handleRevocation(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth revocation failed:', error);
    return jsonError('server_error', 500);
  }
}

/** Return the CORS preflight headers for browser-based token revocation. */
export function OPTIONS() {
  return corsPreflight();
}
