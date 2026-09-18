import { cacheLife } from 'next/cache';
import RSS from 'rss';

import { site } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';

const SITE_URL = site.origin;

async function buildWritingsFeed() {
  'use cache';
  cacheLife('hours');

  const writings = await getAllWritings();

  const feed = new RSS({
    title: "Willie's Writings",
    description:
      'Thoughts, tutorials, and notes on software, music, and creativity from Willie Chalmers III.',
    site_url: `${SITE_URL}/writings`,
    feed_url: `${SITE_URL}/writings/feed.xml`,
    language: 'en',
    pubDate: new Date(),
    copyright: `${new Date().getFullYear()} ${site.author.name}`,
    generator: 'Next.js + RSS',
    custom_namespaces: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    custom_elements: [
      {
        'atom:link': {
          _attr: {
            href: `${SITE_URL}/writings/feed.xml`,
            rel: 'self',
            type: 'application/rss+xml',
          },
        },
      },
    ],
  });

  for (const writing of writings) {
    const url = `${SITE_URL}/writings/${writing.slug}`;

    feed.item({
      title: writing.title,
      description: writing.description,
      url,
      guid: url,
      date: new Date(writing.published),
      categories: writing.tags,
      author: site.author.name,
      custom_elements: [{ 'content:encoded': writing.description }],
    });
  }

  return feed.xml({ indent: true });
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
