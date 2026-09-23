import {
  corsPreflight,
  handleRevocation,
} from '@/lib/indieweb/indieauth-endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth-storage';
import { jsonError } from '@/lib/indieweb/responses';

/** The IndieAuth token revocation endpoint (RFC 7009). */
export async function POST(request: Request) {
  try {
    return await handleRevocation(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth revocation failed:', error);
    return jsonError('server_error', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
