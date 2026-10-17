import { unstable_cache } from 'next/cache';

import { loadBlueskyResponses } from '@/lib/atproto/responses';
import { emptyResponses } from '@/lib/atproto/responses/merge';
import { optionalWithin } from '@/lib/http/optional';
import {
  type ReplyContext,
  getReplyContext,
} from '@/lib/indieweb/reply-context';
import { publicWebmentionsForPost } from '@/lib/indieweb/webmention/public-reads';
import type { WebmentionGroup } from '@/lib/indieweb/webmention/types';
import { getBacklinksForPost } from '@/lib/writings/backlinks';
import {
  type SeriesWithWritings,
  type WritingData,
  getAdjacentWritings,
  getSeriesWithWritings,
} from '@/lib/writings/index';

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

async function seriesFor(
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
async function replyContextsFor(
  urls: string[]
): Promise<Map<string, ReplyContext>> {
  return new Map(await loadReplyContexts([...new Set(urls)]));
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

/** Lists the Bluesky copy among the writing's syndication links once. */
export function withBlueskyCopy(
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

/**
 * Everything a writing's page shows around the text: its series, links
 * and responses from elsewhere, its neighbours, and the posts it answers.
 * A source that fails or runs slow leaves its part empty rather than
 * failing the page.
 */
export async function loadWritingRelations(
  writing: WritingData,
  replyTargetUrls: string[]
) {
  const [
    seriesData,
    { backlinks, webmentions },
    adjacentWritings,
    replyContexts,
    atmosphere,
  ] = await Promise.all([
    seriesFor(writing.series?.slug),
    optionalWithin(fetchInteractions(writing.slug), {
      backlinks: [],
      webmentions: null,
    }),
    getAdjacentWritings(writing.slug),
    optionalWithin(
      replyContextsFor(replyTargetUrls),
      new Map<string, ReplyContext>()
    ),
    optionalWithin(loadBlueskyResponses(writing, AbortSignal.timeout(1500)), {
      groups: emptyResponses(),
    }),
  ]);
  return {
    seriesData,
    backlinks,
    webmentions,
    adjacentWritings,
    replyContexts,
    atmosphere,
  };
}
