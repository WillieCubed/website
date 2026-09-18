import RSS from 'rss';

import { getAllProjects } from '@/lib/projects';
import { site } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';

const SITE_URL = site.origin;

export async function GET() {
  const [writings, projects] = await Promise.all([
    getAllWritings(),
    getAllProjects(),
  ]);

  const feed = new RSS({
    title: site.name,
    description:
      'Writings, projects, and updates from Willie Chalmers III who builds software for humans.',
    site_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.xml`,
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
            href: `${SITE_URL}/feed.xml`,
            rel: 'self',
            type: 'application/rss+xml',
          },
        },
      },
      {
        'atom:link': {
          _attr: {
            href: 'https://pubsubhubbub.appspot.com/',
            rel: 'hub',
          },
        },
      },
    ],
  });

  // Add writings
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

  // Add projects
  for (const project of projects) {
    const url = `${SITE_URL}/projects/${project.codename}`;

    feed.item({
      title: project.title,
      description: project.tagline || project.description || '',
      url,
      guid: url,
      date: new Date(project.launched),
      categories: project.type ? [project.type] : [],
      author: site.author.name,
    });
  }

  return new Response(feed.xml({ indent: true }), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
