import { handleMediaPost } from '@/lib/indieweb/media-endpoint';
import { micropubCorsPreflight } from '@/lib/indieweb/micropub/endpoint';

/**
 * Store an uploaded media attachment and return its public URL with HTTP 201
 * and a Location header. Require a valid site token with media, create, or
 * draft scope; reject unsupported or oversized uploads. Return 503 when
 * media storage is not configured.
 */
export async function POST(request: Request) {
  return handleMediaPost(request);
}

/** Return the CORS preflight headers for browser-based media uploads. */
export function OPTIONS() {
  return micropubCorsPreflight();
}
