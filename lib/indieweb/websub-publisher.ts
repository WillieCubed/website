/**
 * Tell the WebSub hub that the site's feeds changed.
 *
 * The hub then fetches each topic and fans it out to subscribers.
 */
import { groupByTag, tagFeedPaths, tagPath } from '../writings/tags';
import { WEBSUB_HUB } from './constants';

export const SITE_FEED_PATHS = [
  '/feed.xml',
  '/feed/atom',
  '/feed/json',
  '/writings/feed.xml',
  '/writings/feed/atom',
  '/writings/feed/json',
];

/**
 * HTML pages that are h-feeds and name the hub and themselves in their
 * head, so a reader can subscribe to the page itself.
 */
export const HTML_FEED_PATHS = ['/writings'];

/** A tag's page, which is an h-feed, and its three feeds. */
export function tagTopicPaths(tag: string): string[] {
  const feeds = tagFeedPaths(tag);
  return [tagPath(tag), feeds.rss, feeds.atom, feeds.json];
}

/**
 * Every topic to publish after a deploy. The hub is not told which posts
 * changed, so every tag's topics go out each time, as the site feeds do.
 */
export function webSubTopicPaths(tags: string[]): string[] {
  return [
    ...SITE_FEED_PATHS,
    ...HTML_FEED_PATHS,
    ...tags.flatMap(tagTopicPaths),
  ];
}

/**
 * The topics for the tags published now. It reads through the uncached
 * loader because `pnpm websub:ping` runs under plain Node, where
 * `cacheLife()` throws. If the posts cannot be read, the site and HTML
 * feeds still go out rather than nothing.
 */
export async function publishedTopicPaths(): Promise<string[]> {
  try {
    const { getWritingSlugs, loadWriting } = await import('../writings');
    const loaded = await Promise.all(
      (await getWritingSlugs()).map((slug) => loadWriting(slug))
    );
    const published = loaded
      .map(({ writing }) => writing)
      .filter((writing) => !writing.draft);
    return webSubTopicPaths(groupByTag(published).map(({ tag }) => tag));
  } catch (error) {
    console.error('WebSub could not read the published tags:', error);
    return webSubTopicPaths([]);
  }
}

const FETCH_TIMEOUT_MS = 10_000;

export async function pingWebSubHub(
  feedUrls: string[],
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
