import { buildLlmsSummary } from '@/lib/indieweb/discovery';
import { isHiatusMode } from '@/lib/site-mode';
import { getAllWritings } from '@/lib/writings';

export async function GET() {
  // getAllWritings leaves drafts out in production, so an unpublished
  // writing never appears in this file. proxy.ts 404s /writings in hiatus
  // mode, so no writing is linked then either.
  const writings = isHiatusMode() ? [] : await getAllWritings();

  return new Response(buildLlmsSummary(writings), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
