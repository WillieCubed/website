import { getEntityRegistry } from '@/lib/entities/registry';

/**
 * The hover-card registry. Fetched once per visit by SiteLink on first
 * intent, so a page with a hundred links costs one small request.
 */
export async function GET() {
  const registry = await getEntityRegistry();
  return Response.json(registry, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
