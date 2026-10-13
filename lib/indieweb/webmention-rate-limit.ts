import type { RateLimit } from '@cloudflare/workers-types';

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
 * Cloudflare supplies the visitor IP in `CF-Connecting-IP`; clients can
 * prepend their own address to `X-Forwarded-For`. Local and non-Cloudflare
 * requests retain the old forwarded-address fallback.
 */
export function webmentionRateLimitKey(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

/**
 * A fast, location-local guard before the Postgres counter. The Postgres
 * counter remains authoritative because Cloudflare's edge counter is
 * eventually consistent and does not share counts between locations.
 */
export async function isWithinEdgeWebmentionRateLimit(
  limiter: Pick<RateLimit, 'limit'> | undefined,
  key: string
): Promise<boolean> {
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch (error) {
    console.error('Cloudflare Webmention rate limit check failed:', error);
    return true;
  }
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
