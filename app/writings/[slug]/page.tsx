import { redirect } from 'next/navigation';
import { Metadata } from 'next/types';

import PostInteractions from '@/components/writings/PostInteractions';
import PostNavigation from '@/components/writings/PostNavigation';
import WritingContent from '@/components/writings/WritingContent';
import WritingHeader from '@/components/writings/WritingHeader';

import { OEMBED_ENDPOINT, SITE_URL } from '@/lib/indieweb/constants';
import {
  type ReplyContext,
  getReplyContext,
} from '@/lib/indieweb/reply-context';
import { getWebmentionsForPost } from '@/lib/indieweb/webmention-storage';
import { absoluteRoute } from '@/lib/site';
import {
  SeriesWithWritings,
  WritingData,
  getAdjacentWritings,
  getSeriesWithWritings,
  getWriting,
  getWritingSlugs,
} from '@/lib/writings';
import { getBacklinksForPost } from '@/lib/writings/backlinks';

function generateCanonicalUrl(slug: string) {
  return absoluteRoute`/writings/${slug}`;
}

export async function generateStaticParams() {
  const slugs = await getWritingSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;
  const { writing } = await getWriting(slug);
  const canonicalUrl = generateCanonicalUrl(writing.slug);
  return {
    title: writing.title,
    description: writing.description,
    alternates: {
      canonical: canonicalUrl,
      types: {
        'application/rss+xml': `${canonicalUrl}/activity/feed.xml`,
        'application/atom+xml': `${canonicalUrl}/activity/feed/atom`,
        'application/feed+json': `${canonicalUrl}/activity/feed/json`,
        'application/json+oembed': `${SITE_URL}${OEMBED_ENDPOINT}?url=${encodeURIComponent(
          canonicalUrl
        )}`,
      },
    },
    openGraph: {
      type: 'article',
      title: writing.title,
      description: writing.description,
      publishedTime: new Date(writing.published).toISOString(),
      modifiedTime: new Date(writing.lastUpdated).toISOString(),
      url: canonicalUrl,
      images: writing.featuredImage ? [writing.featuredImage] : undefined,
    },
  };
}

interface WritingDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function fetchWritingData(slug: string) {
  const writingData = await getWriting(slug);
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

  let webmentions = null;
  try {
    webmentions = await getWebmentionsForPost(slug);
  } catch {
    // Webmentions not available
  }

  return { backlinks, webmentions };
}

/**
 * Fetch reply context for interaction posts.
 * Returns context for like, repost, bookmark, rsvp, or inReplyTo targets.
 */
async function fetchReplyContexts(
  writing: WritingData
): Promise<Map<string, ReplyContext>> {
  const contexts = new Map<string, ReplyContext>();

  // Collect all URLs that need context
  const urls: string[] = [];
  if (writing.likeOf) urls.push(writing.likeOf);
  if (writing.repostOf) urls.push(writing.repostOf);
  if (writing.bookmarkOf) urls.push(writing.bookmarkOf);
  if (writing.rsvp?.eventUrl) urls.push(writing.rsvp.eventUrl);
  if (writing.inReplyTo) urls.push(writing.inReplyTo);

  // Fetch contexts in parallel
  await Promise.all(
    urls.map(async (url) => {
      try {
        const context = await getReplyContext(url);
        contexts.set(url, context);
      } catch (error) {
        console.error(`Failed to fetch context for ${url}:`, error);
        // Store minimal context on error
        contexts.set(url, { url, fetchedAt: new Date() });
      }
    })
  );

  return contexts;
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
    return redirect('/404');
  }

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

  const canonicalUrl = generateCanonicalUrl(writing.slug);

  return (
    <article className="h-entry mx-auto max-w-breakpoint-2xl">
      <WritingHeader
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

      <section className="mx-auto max-w-breakpoint-md px-lg pb-2xl desktop:px-0">
        <PostInteractions
          webmentions={webmentions}
          backlinks={backlinks}
          slug={slug}
        />

        <PostNavigation
          previous={adjacentWritings.previous}
          next={adjacentWritings.next}
        />
      </section>
    </article>
  );
}
