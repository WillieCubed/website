import { SITE_URL } from '@/lib/indieweb/constants';
import {
  jsonError,
  jsonResponse,
  noStoreJsonHeaders,
} from '@/lib/indieweb/responses';
import { sameOrigin } from '@/lib/indieweb/utils';
import { getPublicWebmentionsForTarget } from '@/lib/indieweb/webmention/storage';

/**
 * Return grouped, verified, approved webmentions for the same-origin target
 * query parameter. Return 400 when the target is missing or external;
 * disable response caching.
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
