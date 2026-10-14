import { buildLlmsSummary } from '@/lib/indieweb/discovery';
import { getAllWritings } from '@/lib/writings/index';

/**
 * Return a Markdown summary of the site, public writings, and configured
 * discovery endpoints for automated readers. Production responses exclude
 * draft writings.
 */
export async function GET() {
  // The production loader excludes drafts from this public summary.
  const writings = await getAllWritings();

  return new Response(buildLlmsSummary(writings), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
