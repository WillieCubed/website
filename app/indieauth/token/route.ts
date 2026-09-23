import {
  corsPreflight,
  handleTokenRequest,
  handleTokenVerification,
} from '@/lib/indieweb/indieauth-endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth-storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * The IndieAuth token endpoint.
 *
 * POST redeems a code for an access token, or revokes one with
 * `action=revoke`. GET with a bearer token answers who the token belongs to,
 * the verification call older Micropub servers make.
 */
export async function GET(request: Request) {
  try {
    return await handleTokenVerification(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth token verification failed:', error);
    return jsonError('server_error', 500);
  }
}

export async function POST(request: Request) {
  try {
    return await handleTokenRequest(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth token request failed:', error);
    return jsonError('server_error', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
