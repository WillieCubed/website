import { SITE_URL } from '@/lib/indieweb/constants';
import {
  jsonError,
  jsonResponse,
  noStoreJsonHeaders,
} from '@/lib/indieweb/responses';
import { sameOrigin } from '@/lib/indieweb/utils';
import { getPublicWebmentionsForTarget } from '@/lib/indieweb/webmention-storage';

/**
 * Public Webmention listing endpoint.
 *
 * This mirrors the Hypertext Studio pattern: pages can render from database
 * state, while other tools can also fetch grouped, approved mentions for a
 * canonical target URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('target');

  if (!target) return jsonError('missing_target', 400);
  if (!sameOrigin(target, SITE_URL)) return jsonError('invalid_target', 400);

  try {
    return jsonResponse(await getPublicWebmentionsForTarget(target), {
      headers: noStoreJsonHeaders(),
    });
  } catch (error) {
    console.error('Public webmentions failed:', error);
    return jsonError('server_error', 500);
  }
}
