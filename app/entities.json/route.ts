import { getEntityRegistry } from '@/lib/entities/registry';

/**
 * Return page and content metadata indexed by link target for hover cards.
 * Include titles, descriptions, and available preview details.
 */
export async function GET() {
  const registry = await getEntityRegistry();
  return Response.json(registry, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
