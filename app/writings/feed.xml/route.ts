import { generateWritingsRssFeed } from '@/lib/feeds';
import { getWritingFeedItems } from '@/lib/feeds/items';

async function buildWritingsFeed() {
  return generateWritingsRssFeed(await getWritingFeedItems());
}

export async function GET() {
  const feed = await buildWritingsFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
