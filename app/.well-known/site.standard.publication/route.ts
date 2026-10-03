import { PUBLICATION_URI } from '@/lib/atproto/config';

/**
 * standard.site verification: the AT-URI of the publication this origin
 * hosts, and nothing else. Readers compare it with the record's `url`.
 * 404 while the publication is not configured.
 */
export async function GET() {
  if (!PUBLICATION_URI) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
  return new Response(PUBLICATION_URI, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
