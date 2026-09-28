import { notFound } from 'next/navigation';
import type { Metadata } from 'next/types';

import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';
import WritingsIndex from '@/components/writings/WritingsIndex';

import {
  breadcrumbLd,
  graph,
  personLd,
  webPageLd,
  websiteLd,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/site';
import { getTagGroup, getTagParams } from '@/lib/writings';
import {
  tagFeedPaths,
  tagFromParam,
  tagPath,
  writingCount,
} from '@/lib/writings/tags';

interface TagPageProps {
  params: Promise<{ tag: string }>;
}

export async function generateStaticParams() {
  return getTagParams();
}

async function loadTag(props: TagPageProps) {
  const { tag } = await props.params;
  return (await getTagGroup(tagFromParam(tag))) ?? notFound();
}

export async function generateMetadata(props: TagPageProps): Promise<Metadata> {
  const { tag, writings } = await loadTag(props);
  const path = tagPath(tag);
  const feeds = tagFeedPaths(tag);
  const metadata = pageMetadata({
    // A bare tag in a preview on X or iMessage reads as a word; the hash
    // says it is a tag without the site name around it.
    title: `#${tag}`,
    description: writingCount(writings.length),
    path,
    image: `${path}/opengraph-image`,
  });
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      types: {
        'application/rss+xml': feeds.rss,
        'application/atom+xml': feeds.atom,
        'application/feed+json': feeds.json,
      },
    },
  };
}

export default async function TagPage(props: TagPageProps) {
  const { tag, writings } = await loadTag(props);
  const path = tagPath(tag);

  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            type: 'CollectionPage',
            name: `#${tag}`,
            description: writingCount(writings.length),
            path,
            image: `${path}/opengraph-image`,
            items: writings.map((writing) => ({
              name: writing.title,
              path: `/writings/${writing.slug}`,
            })),
          }),
          breadcrumbLd([
            { name: 'Writings', path: '/writings' },
            { name: tag, path },
          ]),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar
        column="content"
        crumbs={[{ label: 'Writings', href: '/writings' }]}
      />
      <WritingsIndex
        name={tag}
        path={path}
        writings={writings}
        currentTag={tag}
      />
    </>
  );
}
