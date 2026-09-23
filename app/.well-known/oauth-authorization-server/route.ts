import { buildIndieAuthMetadata } from '@/lib/indieweb/indieauth-server';
import { jsonResponse } from '@/lib/indieweb/responses';

/**
 * IndieAuth server metadata (RFC 8414), advertised by
 * `<link rel="indieauth-metadata">` in the head and in WebFinger. Browser
 * clients read it cross-origin, so it allows any origin.
 */
export async function GET() {
  return jsonResponse(buildIndieAuthMetadata(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
