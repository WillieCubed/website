import { unstable_cache } from 'next/cache';
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
import { loadBlueskyResponses } from '@/lib/atproto/responses';
import { emptyResponses } from '@/lib/atproto/responses/merge';
import { mergeResponses } from '@/lib/atproto/responses/merge';
import { optionalWithin } from '@/lib/http/optional';
import { OEMBED_ENDPOINT, SITE_URL } from '@/lib/indieweb/constants';
import {
  type ReplyContext,
  getReplyContext,
} from '@/lib/indieweb/reply-context';
import { publicWebmentionsForPost } from '@/lib/indieweb/webmention/public-reads';
import type { WebmentionGroup } from '@/lib/indieweb/webmention/types';
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
import { getBacklinksForPost } from '@/lib/writings/backlinks';
import {
  SeriesWithWritings,
  WritingData,
  getAdjacentWritings,
  getAllWritings,
  getPublishedWriting,
  getPublishedWritingSlugs,
  getSeriesWithWritings,
} from '@/lib/writings/index';

// Keep rendered replies and webmentions close to the previous one-minute
// cache window. Without this, the status fetch in the root layout makes the
// entire writing page eligible for a 15-minute static snapshot.
export const revalidate = 60;

// An interaction target's metadata changes slowly. Cache this public read
// separately from the page so each one-minute page refresh does not query
// Postgres and keep the Neon compute awake under routine traffic.
const cachedReplyContext = unstable_cache(
  async (url: string) => {
    const context = await getReplyContext(url);
    return {
      ...context,
      publishedAt: context.publishedAt?.toISOString(),
      fetchedAt: context.fetchedAt.toISOString(),
    };
  },
  ['public-reply-context'],
  { revalidate: 3 * 60 * 60 }
);

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

async function fetchWritingData(slug: string) {
  const writingData = await getPublishedWriting(slug);
  return {
    content: writingData.content,
    writing: writingData.writing as WritingData,
    headings: writingData.headings,
  };
}

async function fetchSeriesData(
  seriesSlug: string | undefined
): Promise<SeriesWithWritings | null> {
  if (!seriesSlug) return null;
  try {
    return await getSeriesWithWritings(seriesSlug);
  } catch {
    return null;
  }
}

async function fetchInteractions(slug: string) {
  const backlinks = await getBacklinksForPost(slug);
  const webmentions = await loadWebmentions(slug);
  return { backlinks, webmentions };
}

/** A missing database leaves the interaction area empty, not the page broken. */
async function loadWebmentions(slug: string): Promise<WebmentionGroup | null> {
  try {
    return await publicWebmentionsForPost(slug);
  } catch {
    return null;
  }
}

/**
 * Fetch reply context for interaction posts.
 * Returns context for like, repost, bookmark, rsvp, or inReplyTo targets.
 */
async function fetchReplyContexts(
  writing: WritingData
): Promise<Map<string, ReplyContext>> {
  const urls = [
    ...new Set(replyTargetsOf(writing).map((target) => target.url)),
  ];
  return new Map(await loadReplyContexts(urls));
}

/** Fetch remote reply context during rendering and tolerate source failures. */
async function loadReplyContexts(
  urls: string[]
): Promise<Array<[string, ReplyContext]>> {
  return Promise.all(
    urls.map(async (url): Promise<[string, ReplyContext]> => {
      try {
        const context = await cachedReplyContext(url);
        return [
          url,
          {
            ...context,
            publishedAt: context.publishedAt
              ? new Date(context.publishedAt)
              : undefined,
            fetchedAt: new Date(context.fetchedAt),
          },
        ];
      } catch (error) {
        console.error(`Failed to fetch context for ${url}:`, error);
        return [url, { url, fetchedAt: new Date() }];
      }
    })
  );
}

function withBlueskyCopy(
  writing: WritingData,
  copyUrl: string | null | undefined
): WritingData {
  if (copyUrl && !writing.syndication?.some((copy) => copy.url === copyUrl)) {
    return {
      ...writing,
      syndication: [
        ...(writing.syndication ?? []),
        { name: 'Bluesky', url: copyUrl },
      ],
    };
  }
  return writing;
}

export default async function WritingDetailPage(props: WritingDetailPageProps) {
  const params = await props.params;
  const { slug } = params;

  // Fetch writing data
  let content: string, writing: WritingData, headings;
  try {
    const data = await fetchWritingData(slug);
    content = data.content;
    writing = data.writing;
    headings = data.headings;
  } catch {
    notFound();
  }
  const recentWritings = (await getAllWritings()).slice(0, 6);

  // Fetch related data in parallel
  const [
    seriesData,
    { backlinks, webmentions },
    adjacentWritings,
    replyContexts,
    atmosphere,
  ] = await Promise.all([
    fetchSeriesData(writing.series?.slug),
    optionalWithin(fetchInteractions(slug), {
      backlinks: [],
      webmentions: null,
    }),
    getAdjacentWritings(slug),
    optionalWithin(
      fetchReplyContexts(writing),
      new Map<string, ReplyContext>()
    ),
    optionalWithin(loadBlueskyResponses(writing, AbortSignal.timeout(1500)), {
      groups: emptyResponses(),
    }),
  ]);

  const responses = mergeResponses(webmentions, atmosphere.groups);
  writing = withBlueskyCopy(writing, atmosphere.copyUrl);
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
