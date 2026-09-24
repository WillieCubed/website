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
  let status: number | undefined;
  let failure: { ok: false; status?: number; error?: string } | null = null;
  for (const feedUrl of feedUrls) {
    const body = new URLSearchParams({
      'hub.mode': 'publish',
      'hub.url': feedUrl,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(hub, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      if (response.ok) status = response.status;
      if (!response.ok && !failure) {
        const missingTopic =
          hub === WEBSUB_HUB &&
          response.status === 500 &&
          (await response.text()).includes('Topic not found for topic URL.');
        if (!missingTopic) failure = { ok: false, status: response.status };
      }
    } catch (error) {
      if (!failure)
        failure = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
    } finally {
      clearTimeout(timeout);
    }
  }
  return failure ?? { ok: true, status };
}
