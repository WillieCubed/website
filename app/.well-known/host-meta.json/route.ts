import { buildHostMetaResponse } from '@/lib/indieweb/discovery';
import { jsonResponse } from '@/lib/indieweb/responses';

/**
 * Return JSON host metadata that tells discovery clients how to look up a
 * resource through WebFinger.
 */
export async function GET() {
  return jsonResponse(buildHostMetaResponse(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
