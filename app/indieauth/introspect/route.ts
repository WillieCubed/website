import { handleIntrospection } from '@/lib/indieweb/indieauth/endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth/storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * Return whether the form token is active and its authorization details.
 * Require the INDIEAUTH_INTROSPECTION_SECRET bearer token; unknown or
 * expired tokens return active: false.
 */
export async function POST(request: Request) {
  try {
    return await handleIntrospection(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth introspection failed:', error);
    return jsonError('server_error', 500);
  }
}
