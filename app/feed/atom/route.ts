import { cacheLife } from 'next/cache';

import {
  type FeedItem,
  generateAtomFeed,
  projectToFeedItem,
  writingToFeedItem,
} from '@/lib/feeds';
import { getAllProjects } from '@/lib/projects';
import { siteRoute } from '@/lib/url-utils';
import { getAllWritings } from '@/lib/writings';

async function buildFeed() {
  'use cache';
  cacheLife('hours');

  const [writings, projects] = await Promise.all([
    getAllWritings(),
    getAllProjects(),
  ]);

  const items: FeedItem[] = [
    ...writings.map(writingToFeedItem),
    ...projects.map(projectToFeedItem),
  ].sort((a, b) => b.published.getTime() - a.published.getTime());

  const feed = generateAtomFeed(items, {
    feedUrl: siteRoute`/feed/atom`,
  });

  return feed;
}

export async function GET() {
  const feed = await buildFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
