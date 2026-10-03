import { buildAtProtocolDid } from '@/lib/indieweb/discovery';

/** The AT Protocol DID this domain vouches for; 404 when none is configured. */
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
