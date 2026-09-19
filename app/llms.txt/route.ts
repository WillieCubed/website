import { buildLlmsSummary } from '@/lib/indieweb/discovery';
import { getAllWritings } from '@/lib/writings';

export async function GET() {
  // getAllWritings leaves drafts out in production, so an unpublished
  // writing never appears in this file.
  const writings = await getAllWritings();

  return new Response(buildLlmsSummary(writings), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
