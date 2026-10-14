import { PUBLICATION_URI } from '@/lib/atproto/config';

/**
 * Return the publication's AT-URI as plain text so readers can verify that
 * its record points to this origin. Return 404 when no publication is
 * configured.
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
