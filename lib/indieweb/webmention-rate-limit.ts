import type { WebmentionRateLimitStore } from '@/lib/indieweb/types';

/**
 * Rate limiting for `POST /api/webmention`. Counts live in Postgres rather
 * than in memory, so the limit holds across serverless instances. The route
 * reaches them through a `WebmentionRateLimitStore` so the logic runs without
 * a database in tests.
 */

export const WEBMENTION_RATE_LIMIT = 10; // requests per window
export const WEBMENTION_RATE_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * The key a request is counted under: the first `X-Forwarded-For` address,
 * then `X-Real-IP`, then one shared bucket for requests carrying neither.
 */
export function webmentionRateLimitKey(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

/**
 * Record one request and resolve to whether it is within the limit. When the
 * count cannot be read the request goes through: a missing table should not
 * turn every sender away, and storing the mention needs the same database, so
 * an outage still fails there.
 */
export async function isWithinWebmentionRateLimit(
  store: WebmentionRateLimitStore,
  key: string,
  limit = WEBMENTION_RATE_LIMIT,
  windowMs = WEBMENTION_RATE_WINDOW_MS
): Promise<boolean> {
  try {
    return (await store.hit(key, windowMs)) <= limit;
  } catch (error) {
    console.error('Webmention rate limit check failed:', error);
    return true;
  }
}
