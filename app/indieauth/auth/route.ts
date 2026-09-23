import {
  corsPreflight,
  handleAuthorizationRequest,
  handleProfileRedemption,
} from '@/lib/indieweb/indieauth-endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth-storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * The IndieAuth authorization endpoint.
 *
 * GET forwards the browser to /indieauth/consent with the same query, where
 * the owner approves or denies the request. POST redeems a code for the
 * profile URL alone, for clients that only sign people in.
 */
export function GET(request: Request) {
  return handleAuthorizationRequest(request);
}

export async function POST(request: Request) {
  try {
    return await handleProfileRedemption(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth profile redemption failed:', error);
    return jsonError('server_error', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
