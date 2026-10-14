import { buildHostMetaXml } from '@/lib/indieweb/discovery';

/**
 * Return XRD host metadata that tells discovery clients how to look up a
 * resource through WebFinger.
 */
export async function GET() {
  return new Response(buildHostMetaXml(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/xrd+xml; charset=utf-8',
    },
  });
}
