import { mf2 } from 'microformats-parser';

import {
  type AuthorshipOptions,
  discoverAuthor,
  findEntry,
} from '@/lib/indieweb/authorship';
import { commentHtml, commentText } from '@/lib/indieweb/comment-content';
import { SITE_URL } from '@/lib/indieweb/constants';
import {
  type AddressResolver,
  type DocumentFetch,
  fetchPublicDocument,
} from '@/lib/indieweb/public-fetch';
import type {
  WebmentionType,
  WebmentionVerificationResult,
} from '@/lib/indieweb/types';
import { sameOrigin } from '@/lib/indieweb/utils';
import {
  getWebmentionBySourceTarget,
  markWebmentionDeleted,
  updateVerifiedWebmention,
} from '@/lib/indieweb/webmention-storage';
import { linksToTarget } from '@/lib/indieweb/webmention-targets';
import type { RSVPStatus } from '@/lib/writings/types';

export { extractAuthor } from '@/lib/indieweb/authorship';

// Extract MicroformatRoot type from the mf2 return type
type ParsedDocument = ReturnType<typeof mf2>;
type MicroformatRoot = ParsedDocument['items'][number];
type MicroformatProperty = MicroformatRoot['properties'][string][number];

const SOURCE_TIMEOUT_MS = 10000;
/** A source page larger than this is refused rather than read. */
const SOURCE_MAX_BYTES = 2 * 1024 * 1024;

export interface VerifyWebmentionOptions extends AuthorshipOptions {
  /** Resolves host names for the source fetch; the system resolver by default. */
  resolve?: AddressResolver;
  /** Requests the source; a public-only fetch by default. */
  fetch?: DocumentFetch;
}

/**
 * Verify a webmention by fetching the source and checking for a link to the target.
 */
export async function verifyWebmention(
  id: string,
  sourceUrl: string,
  targetUrl: string,
  options: VerifyWebmentionOptions = {}
): Promise<WebmentionVerificationResult> {
  try {
    // Validate the source URL; sameOrigin rejects an invalid target below
    const source = new URL(sourceUrl);

    // Reject if source is from our own domain (unless intentional)
    if (source.hostname === new URL(SITE_URL).hostname) {
      return { success: false, error: 'Self-mentions not allowed' };
    }

    // Reject if target is not on our domain
    if (!sameOrigin(targetUrl, SITE_URL)) {
      return { success: false, error: 'Target is not on this site' };
    }

    // Anyone can name any source, so it is fetched only from public addresses.
    const document = await fetchPublicDocument(sourceUrl, {
      resolve: options.resolve,
      fetch: options.fetch,
      headers: {
        Accept: 'text/html',
        'User-Agent': 'WillieCubed-Webmention-Verifier/1.0',
      },
      maxBytes: SOURCE_MAX_BYTES,
      timeoutMs: SOURCE_TIMEOUT_MS,
    });
    if (!document) {
      return {
        success: false,
        error: 'Source is not a public page, or is too large to read',
      };
    }

    // Handle 410 Gone - source explicitly deleted
    if (document.status === 410) {
      await markWebmentionDeleted(id);
      return {
        success: true,
        isDeleted: true,
        error: 'Source returned 410 Gone',
      };
    }

    // Handle 404 - source no longer exists
    if (document.status === 404) {
      await markWebmentionDeleted(id);
      return {
        success: true,
        isDeleted: true,
        error: 'Source returned 404 Not Found',
      };
    }

    if (document.status < 200 || document.status > 299) {
      return {
        success: false,
        error: `Failed to fetch source: ${document.status}`,
      };
    }

    const html = document.body;

    // Check if the source actually links to the target
    if (!linksToTarget(html, targetUrl)) {
      // Source no longer links to target - this is a delete
      await markWebmentionDeleted(id);
      return {
        success: true,
        isDeleted: true,
        error: 'Source no longer links to target',
      };
    }

    // Relative links resolve against where the source ended up.
    const parsed = mf2(html, { baseUrl: document.url });
    const found = findEntry(parsed.items);

    if (!found) {
      // No h-entry found, but link exists - treat as simple mention
      await updateVerifiedWebmention(id, { type: 'mention' });
      return { success: true, type: 'mention' };
    }

    const hEntry = found.entry;

    // Determine webmention type
    const type = determineWebmentionType(hEntry, targetUrl);
    const rsvp = type === 'rsvp' ? rsvpAnswer(hEntry) : undefined;

    const author = await discoverAuthor(parsed, found, document.url, options);

    const { text: content, html: contentHtml } = extractContent(
      hEntry,
      document.url
    );

    // Extract published date
    const publishedAt = extractPublishedDate(hEntry);

    // Update the webmention record
    await updateVerifiedWebmention(id, {
      type,
      rsvp,
      authorName: author.name,
      authorUrl: author.url,
      authorPhoto: author.photo,
      content,
      contentHtml,
      publishedAt,
      rawMf2: hEntry,
    });

    return {
      success: true,
      type,
      ...(rsvp ? { rsvp } : {}),
      author,
      content,
      ...(contentHtml ? { contentHtml } : {}),
      publishedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * The addresses a property value can name. A bare `u-like-of` parses as a
 * string, but the usual `u-in-reply-to h-cite` parses as an embedded item
 * whose address sits in its `url` property, and a `u-url` on an image parses
 * as `{value, alt}`. The item's own `value` is the parser's pick of that
 * address for a `u-*` property, or its name for a `p-*` one.
 */
function propertyUrls(value: MicroformatProperty): string[] {
  if (typeof value === 'string') return [value];
  const urls: string[] = [];
  if ('properties' in value) {
    for (const url of value.properties.url ?? []) {
      if (typeof url === 'string') urls.push(url);
      else if ('value' in url && typeof url.value === 'string') {
        urls.push(url.value);
      }
    }
  }
  if (typeof value.value === 'string') urls.push(value.value);
  return urls;
}

function determineWebmentionType(
  hEntry: MicroformatRoot,
  targetUrl: string
): WebmentionType {
  const properties = hEntry.properties;
  const cites = (property: string) =>
    properties[property]?.some((value) =>
      propertyUrls(value).some((url) => linksToTarget(url, targetUrl))
    );

  // Check for specific interaction types
  if (cites('like-of')) return 'like';
  if (cites('repost-of')) return 'repost';
  // An RSVP is a reply to the event that also says whether they will come.
  if (cites('in-reply-to')) return rsvpAnswer(hEntry) ? 'rsvp' : 'reply';
  if (cites('bookmark-of')) return 'bookmark';

  return 'mention';
}

const RSVP_ANSWERS: readonly RSVPStatus[] = [
  'yes',
  'no',
  'maybe',
  'interested',
];

/**
 * The entry's `p-rsvp` answer, if it gives one the RSVP spec defines. The
 * values are case-insensitive, so `Yes` counts as `yes`; anything else, such
 * as `remote yes`, leaves the entry a plain reply.
 */
function rsvpAnswer(hEntry: MicroformatRoot): RSVPStatus | undefined {
  const [value] = hEntry.properties.rsvp ?? [];
  const text =
    typeof value === 'string'
      ? value
      : value && 'value' in value && typeof value.value === 'string'
        ? value.value
        : undefined;
  const answer = text?.trim().toLowerCase();
  return RSVP_ANSWERS.find((known) => known === answer);
}

/**
 * What a reply says, as plain text for feeds, search, and moderation, and,
 * when the source marked it up as `e-content`, as sanitized markup for the
 * post to show. A `p-content`, `p-summary`, or name is text only.
 */
function extractContent(
  hEntry: MicroformatRoot,
  baseUrl: string
): { text?: string; html?: string } {
  const properties = hEntry.properties;
  const content =
    properties.content?.[0] || properties.summary?.[0] || properties.name?.[0];

  if (typeof content === 'string') return { text: commentText(content) };
  if (!content || !('value' in content) || typeof content.value !== 'string') {
    return {};
  }
  const html =
    'html' in content && typeof content.html === 'string'
      ? commentHtml(content.html, baseUrl)
      : undefined;
  return { text: commentText(content.value), html };
}

function extractPublishedDate(hEntry: MicroformatRoot): Date | undefined {
  const properties = hEntry.properties;
  const published = properties.published?.[0];
  if (!published) return undefined;

  if (typeof published === 'string') {
    const date = new Date(published);
    return isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}
