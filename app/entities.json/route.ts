import { createHash } from 'node:crypto';

import { prepareEntityPreviews } from '@/lib/entities/previews';
import { getEntityRegistry } from '@/lib/entities/registry';
import { matchesEntityTag } from '@/lib/http/validators';

/**
 * Return page and content metadata indexed by link target for hover cards.
 * Include titles, descriptions, and available preview details.
 */
export async function GET(request: Request) {
  const registry = await getEntityRegistry();
  const body = JSON.stringify(prepareEntityPreviews(registry));
  const tag = `"${createHash('sha256').update(body).digest('hex')}"`;
  const unchanged = matchesEntityTag(request.headers.get('If-None-Match'), tag);
  return new Response(unchanged ? null : body, {
    status: unchanged ? 304 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      ETag: tag,
    },
  });
}
