import { notFound } from 'next/navigation';
import { Metadata } from 'next/types';

import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';
import PostInteractions from '@/components/writings/PostInteractions';
import PostNavigation from '@/components/writings/PostNavigation';
import { replyTargetsOf } from '@/components/writings/ReplyTarget';
import WritingContent from '@/components/writings/WritingContent';
import WritingHeader from '@/components/writings/WritingHeader';

import { documentUri } from '@/lib/atproto/keys';
import { documentPath } from '@/lib/atproto/records';
import { mergeResponses } from '@/lib/atproto/responses/merge';
import { OEMBED_ENDPOINT, SITE_URL } from '@/lib/indieweb/constants';
import {
  breadcrumbLd,
  graph,
  personLd,
  postingLd,
  postingType,
  websiteLd,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/site/dates';
import { absoluteRoute, feedAlternates } from '@/lib/site/urls';
import {
  WritingData,
  getAllWritings,
  getPublishedWriting,
  getPublishedWritingSlugs,
} from '@/lib/writings/index';
import {
  loadWritingRelations,
  withBlueskyCopy,
} from '@/lib/writings/page-data';

// Keep rendered replies and webmentions close to the previous one-minute
// cache window. Without this, the status fetch in the root layout makes the
// entire writing page eligible for a 15-minute static snapshot.
export const revalidate = 60;

function generateCanonicalUrl(slug: string) {
  return absoluteRoute`/writings/${slug}`;
}

// Cache Components refuses an empty list at build time. When nothing is
// published, one underscore path stands in: the loaders treat the prefix
// as hidden, so it prerenders as a plain 404 and no draft is involved.
export async function generateStaticParams() {
  const slugs = await getPublishedWritingSlugs();
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: '_' }];
}

export async function generateMetadata(
  props: PageProps<'/writings/[slug]'>
): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;
  // An unknown slug has to reach notFound() here too; metadata that
  // resolved to nothing would replace the 404 page's title.
  const { writing } = await getPublishedWriting(slug).catch(() => notFound());
  const canonicalUrl = generateCanonicalUrl(writing.slug);
  const path = `/writings/${writing.slug}`;
  const metadata = pageMetadata({
    title: writing.title,
    description: writing.description,
    path,
    image: writing.featuredImage || `${path}/opengraph-image`,
    imageAlt: writing.featuredImageAlt || writing.title,
    type: 'article',
    publishedTime: writing.published,
    modifiedTime: writing.lastUpdated,
    tags: writing.tags,
    labels: [
      ['Reading time', `${writing.readingTime} min`],
      ['Published', formatDate(writing.published)],
    ],
  });
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      types: {
        ...feedAlternates(`${canonicalUrl}/activity`),
        'application/json+oembed': `${SITE_URL}${OEMBED_ENDPOINT}?url=${encodeURIComponent(
          canonicalUrl
        )}`,
      },
    },
  };
}

type WritingDetailPageProps = PageProps<'/writings/[slug]'>;

export default async function WritingDetailPage(props: WritingDetailPageProps) {
  const params = await props.params;
  const { slug } = params;

  const { content, headings, ...data } = await getPublishedWriting(slug).catch(
    () => notFound()
  );
  const published = data.writing as WritingData;
  const [
    allWritings,
    {
      seriesData,
      backlinks,
      webmentions,
      adjacentWritings,
      replyContexts,
      atmosphere,
    },
  ] = await Promise.all([
    getAllWritings(),
    loadWritingRelations(
      published,
      replyTargetsOf(published).map((target) => target.url)
    ),
  ]);
  const recentWritings = allWritings.slice(0, 6);

  const responses = mergeResponses(webmentions, atmosphere.groups);
  const writing = withBlueskyCopy(published, atmosphere.copyUrl);
  const canonicalUrl = generateCanonicalUrl(writing.slug);
  const path = `/writings/${writing.slug}`;
  const documentAt = documentUri(documentPath(writing.slug), writing.published);

  return (
    <>
      <JsonLd
        data={graph(
          postingLd({
            type: postingType(writing),
            path,
            title: writing.title,
            description: writing.description,
            published: writing.published,
            updated: writing.lastUpdated,
            tags: writing.tags,
            image: writing.featuredImage || `${path}/opengraph-image`,
            seriesName: seriesData?.name,
          }),
          breadcrumbLd([
            { name: 'Writings', path: '/writings' },
            { name: writing.title, path },
          ]),
          websiteLd(),
          personLd()
        )}
      />
      {/* standard.site: this writing's record. React hoists it into
          <head>, where verifiers read it without running scripts. */}
      {documentAt && <link rel="site.standard.document" href={documentAt} />}
      <TopBar
        column="reading"
        crumbs={[
          {
            label: 'Writings',
            href: '/writings',
            menuItems: recentWritings.map((item) => ({
              label: item.title,
              href: `/writings/${item.slug}`,
            })),
          },
        ]}
      />
      <main id="main">
        <article
          className={`${writing.postType === 'event' ? 'h-entry h-event' : 'h-entry'} mx-auto max-w-breakpoint-2xl`}
        >
          <WritingHeader
            content={content}
            writing={writing}
            seriesData={seriesData}
            canonicalUrl={canonicalUrl}
            replyContexts={replyContexts}
          />

          <WritingContent
            content={content}
            headings={headings}
            writing={writing}
            seriesData={seriesData}
          />

          <section className="mx-auto max-w-breakpoint-md px-lg pb-lg desktop:px-0">
            <PostInteractions
              blueskyReplyUrl={atmosphere.replyUrl}
              webmentions={responses}
              backlinks={backlinks}
              slug={slug}
              target={canonicalUrl}
              writing={writing}
            />

            <PostNavigation
              previous={adjacentWritings.previous}
              next={adjacentWritings.next}
            />
          </section>
        </article>
      </main>
    </>
  );
}
