import { buildWebFingerResponse } from '@/lib/indieweb/discovery';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';

/**
 * WebFinger (RFC 7033). A request without a resource is a 400, and a
 * resource this site does not describe is a 404.
 */
export async function GET(request: Request) {
  const resource = new URL(request.url).searchParams.get('resource');
  if (!resource) return jsonError('missing_resource', 400);

  const response = buildWebFingerResponse(resource);
  if (!response) return jsonError('unknown_resource', 404);

  return jsonResponse(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/jrd+json; charset=utf-8',
    },
  });
}
