import { buildHostMetaXml } from '@/lib/indieweb/discovery';

export async function GET() {
  return new Response(buildHostMetaXml(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/xrd+xml; charset=utf-8',
    },
  });
}
