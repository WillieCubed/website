import { cacheLife, cacheTag } from 'next/cache';
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
import { loadBlueskyResponses, mergeResponses } from '@/lib/atproto/responses';
import { OEMBED_ENDPOINT, SITE_URL } from '@/lib/indieweb/constants';
import {
  type ReplyContext,
  getReplyContext,
} from '@/lib/indieweb/reply-context';
import type { WebmentionGroup } from '@/lib/indieweb/types';
import { getWebmentionsForPost } from '@/lib/indieweb/webmention-storage';
import {
  breadcrumbLd,
  graph,
  personLd,
  postingLd,
  postingType,
  websiteLd,
} from '@/lib/seo/jsonld';
import { absoluteRoute, formatDate, pageMetadata } from '@/lib/site';
import {
  SeriesWithWritings,
  WritingData,
  getAdjacentWritings,
  getAllWritings,
  getPublishedWriting,
  getPublishedWritingSlugs,
  getSeriesWithWritings,
} from '@/lib/writings';
import { getBacklinksForPost } from '@/lib/writings/backlinks';

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

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
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
        'application/rss+xml': `${canonicalUrl}/activity/feed.xml`,
        'application/atom+xml': `${canonicalUrl}/activity/feed/atom`,
        'application/feed+json': `${canonicalUrl}/activity/feed/json`,
        'application/json+oembed': `${SITE_URL}${OEMBED_ENDPOINT}?url=${encodeURIComponent(
          canonicalUrl
        )}`,
      },
    },
  };
}

interface WritingDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

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

/**
 * Approved webmentions are cached for a minute rather than read on every
 * request. A request-time read would stream in after the page, outside the
 * post's h-entry, where a parser no longer sees the replies as its
 * comments. A throw inside the cache scope fails the build, so a missing
 * or unreachable database resolves to nothing instead.
 */
async function loadWebmentions(slug: string): Promise<WebmentionGroup | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag('webmentions');
  try {
    return await getWebmentionsForPost(slug);
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

/**
 * Remote pages are fetched inside a cache scope: it keeps a build from
 * hitting every target on each render, and it is the one place the
 * prerenderer lets a Server Component read the clock and the network.
 */
async function loadReplyContexts(
  urls: string[]
): Promise<Array<[string, ReplyContext]>> {
  'use cache';
  cacheLife('hours');
  return Promise.all(
    urls.map(async (url): Promise<[string, ReplyContext]> => {
      try {
        return [url, await getReplyContext(url)];
      } catch (error) {
        console.error(`Failed to fetch context for ${url}:`, error);
        return [url, { url, fetchedAt: new Date() }];
      }
    })
  );
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
  ] = await Promise.all([
    fetchSeriesData(writing.series?.slug),
    fetchInteractions(slug),
    getAdjacentWritings(slug),
    fetchReplyContexts(writing),
  ]);

  const atmosphere = await loadBlueskyResponses(writing);
  const responses = mergeResponses(webmentions, atmosphere.groups);
  if (
    atmosphere.copyUrl &&
    !writing.syndication?.some((copy) => copy.url === atmosphere.copyUrl)
  ) {
    writing = {
      ...writing,
      syndication: [
        ...(writing.syndication ?? []),
        { name: 'Bluesky', url: atmosphere.copyUrl },
      ],
    };
  }
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
