import {
  corsPreflight,
  handleAuthorizationRequest,
  handleProfileRedemption,
} from '@/lib/indieweb/indieauth/endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth/storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * Redirect the browser to the owner consent page with the authorization
 * query unchanged.
 */
export function GET(request: Request) {
  return handleAuthorizationRequest(request);
}

/**
 * Redeem a form-encoded authorization code and PKCE verifier for the
 * authorized profile URL. Return an OAuth error when the code, client,
 * callback, or verifier is invalid.
 */
export async function POST(request: Request) {
  try {
    return await handleProfileRedemption(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth profile redemption failed:', error);
    return jsonError('server_error', 500);
  }
}

/** Return the CORS preflight headers for browser-based IndieAuth clients. */
export function OPTIONS() {
  return corsPreflight();
}
