import { buildWebFingerResponse } from '@/lib/indieweb/discovery';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';

/**
 * Return the profile and discovery links for the requested resource. Require
 * a resource query parameter; return 400 when missing and 404 when the site
 * does not recognize it.
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
