import { buildLlmsSummary } from '@/lib/indieweb/discovery';
import { getAllWritings } from '@/lib/writings/index';

/**
 * Return a Markdown summary of the site, public writings, and configured
 * discovery endpoints for automated readers. Production responses exclude
 * draft writings.
 */
export async function GET() {
  // Public discovery excludes drafts regardless of deployment mode.
  const writings = await getAllWritings(false);

  return new Response(buildLlmsSummary(writings), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
