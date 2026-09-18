import { buildLlmsSummary } from '@/lib/indieweb/discovery';

export async function GET() {
  return new Response(buildLlmsSummary(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
