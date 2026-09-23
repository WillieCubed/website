import { handleIntrospection } from '@/lib/indieweb/indieauth-endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth-storage';
import { jsonError } from '@/lib/indieweb/responses';

/**
 * The IndieAuth token introspection endpoint (RFC 7662). Callers send
 * `Authorization: Bearer $INDIEAUTH_INTROSPECTION_SECRET` and a form `token`.
 */
export async function POST(request: Request) {
  try {
    return await handleIntrospection(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth introspection failed:', error);
    return jsonError('server_error', 500);
  }
}
