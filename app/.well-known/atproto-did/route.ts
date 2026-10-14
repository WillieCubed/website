import { buildAtProtocolDid } from '@/lib/indieweb/discovery';

/**
 * Return the AT Protocol DID associated with this domain as plain text.
 * Return 404 when no DID is configured.
 */
export async function GET() {
  const body = buildAtProtocolDid();
  if (!body) return new Response('Not found', { status: 404 });
  return new Response(body, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
