import { OPENSEARCH_CONTENT_TYPE, buildOpenSearchXml } from '@/lib/opensearch';

export async function GET() {
  return new Response(buildOpenSearchXml(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': OPENSEARCH_CONTENT_TYPE,
    },
  });
}
