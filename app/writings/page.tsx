import type { Metadata } from 'next/types';

import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';
import WritingsIndex from '@/components/writings/WritingsIndex';

import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { pageMetadata, sitePage } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';

const WRITINGS_PAGE = sitePage('/writings');
const WRITINGS = {
  title: WRITINGS_PAGE.label,
  description: WRITINGS_PAGE.description,
  path: WRITINGS_PAGE.path,
  image: '/writings/opengraph-image',
};

const writingsMetadata = pageMetadata({
  ...WRITINGS,
  imageAlt: 'Writings by Willie Chalmers III',
});

export const metadata: Metadata = {
  ...writingsMetadata,
  alternates: {
    ...writingsMetadata.alternates,
    types: {
      'application/rss+xml': '/writings/feed.xml',
      'application/atom+xml': '/writings/feed/atom',
      'application/feed+json': '/writings/feed/json',
    },
  },
};

export default async function WritingsPage() {
  const writings = await getAllWritings();
  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            type: 'CollectionPage',
            name: WRITINGS.title,
            description: WRITINGS.description,
            path: WRITINGS.path,
            image: WRITINGS.image,
            items: writings.map((writing) => ({
              name: writing.title,
              path: `/writings/${writing.slug}`,
            })),
          }),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar
        column="content"
        crumbs={[{ label: 'Writings', href: '/writings' }]}
      />
      <WritingsIndex
        name={WRITINGS.title}
        path={WRITINGS.path}
        writings={writings}
      />
    </>
  );
}
