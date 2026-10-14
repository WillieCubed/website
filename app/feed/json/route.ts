import { generateJsonFeed } from '@/lib/indieweb/feeds/index';
import { getSiteFeedItems } from '@/lib/indieweb/feeds/items';
import { webSubLinkHeader } from '@/lib/indieweb/websub-discovery';
import { absoluteRoute } from '@/lib/site/urls';

async function buildFeed() {
  return generateJsonFeed(await getSiteFeedItems());
}

/**
 * Return published writings, dated initiatives, and projects, newest first,
 * as JSON Feed.
 */
export async function GET() {
  const feed = await buildFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      Link: webSubLinkHeader(absoluteRoute`/feed/json`),
    },
  });
}
