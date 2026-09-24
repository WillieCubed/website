/**
 * Tell the WebSub hub that the site feeds changed.
 *
 * The hub then fetches each feed and fans it out to subscribers.
 */
import { absoluteUrl } from '../site';
import { WEBSUB_HUB } from './constants';

export const SITE_FEED_PATHS = [
  '/feed.xml',
  '/feed/atom',
  '/feed/json',
  '/writings/feed.xml',
  '/writings/feed/atom',
  '/writings/feed/json',
];

const FETCH_TIMEOUT_MS = 10_000;

export async function pingWebSubHub(
  feedUrls: string[] = SITE_FEED_PATHS.map((path) => absoluteUrl(path)),
  hub = WEBSUB_HUB
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const body = new URLSearchParams();
  body.set('hub.mode', 'publish');
  // Google's hub accepts several feeds in one publish request.
  for (const feedUrl of feedUrls) body.append('hub.url', feedUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(hub, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    return {
      ok: response.ok || response.status === 204,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
