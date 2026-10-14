import { buildIndieAuthMetadata } from '@/lib/indieweb/indieauth/server';
import { jsonResponse } from '@/lib/indieweb/responses';

/**
 * Return IndieAuth authorization, token, introspection, and revocation URLs
 * with supported scopes and PKCE methods. Browser clients may read this
 * metadata across origins.
 */
export async function GET() {
  return jsonResponse(buildIndieAuthMetadata(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
