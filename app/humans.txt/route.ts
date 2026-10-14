import { buildHumansTxt } from '@/lib/protocols/humans-txt';

/**
 * Return the site's author, credits, and technology list as plain text.
 * Include the deployment build date when it is available.
 */
export function GET() {
  const builtAt = process.env.SITE_BUILT_AT;
  return new Response(buildHumansTxt(builtAt ? new Date(builtAt) : undefined), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
