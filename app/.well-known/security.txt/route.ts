import { buildSecurityTxt } from '@/lib/protocols/security-txt';

/**
 * Return the security reporting contact, disclosure policy, and expiration
 * date as plain text.
 */
export async function GET() {
  return new Response(buildSecurityTxt(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
