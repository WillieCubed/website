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
import { getAllTags, getTagGroup } from '@/lib/writings';
import { tagFromParam, tagPath, writingCount } from '@/lib/writings/tags';

interface TagPageProps {
  params: Promise<{ tag: string }>;
}

// Cache Components refuses an empty list at build time. When nothing is
// published, one underscore path stands in: no writing carries it, so it
// prerenders as a plain 404.
export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.length > 0 ? tags.map((tag) => ({ tag })) : [{ tag: '_' }];
}

async function loadTag(props: TagPageProps) {
  const { tag } = await props.params;
  return (await getTagGroup(tagFromParam(tag))) ?? notFound();
}

export async function generateMetadata(props: TagPageProps): Promise<Metadata> {
  const { tag, writings } = await loadTag(props);
  const path = tagPath(tag);
  return pageMetadata({
    // A bare tag in a preview on X or iMessage reads as a word; the hash
    // says it is a tag without the site name around it.
    title: `#${tag}`,
    description: writingCount(writings.length),
    path,
    image: `${path}/opengraph-image`,
  });
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
