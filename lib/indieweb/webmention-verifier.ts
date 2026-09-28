import { mf2 } from 'microformats-parser';
import sanitizeHtml from 'sanitize-html';

import {
  type AuthorshipOptions,
  discoverAuthor,
  findEntry,
} from '@/lib/indieweb/authorship';
import { SITE_URL } from '@/lib/indieweb/constants';
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

const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Verify a webmention by fetching the source and checking for a link to the target.
 */
export async function verifyWebmention(
  id: string,
  sourceUrl: string,
  targetUrl: string,
  options: AuthorshipOptions = {}
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

    // Fetch the source URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html',
          'User-Agent': 'WillieCubed-Webmention-Verifier/1.0',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle 410 Gone - source explicitly deleted
    if (response.status === 410) {
      await markWebmentionDeleted(id);
      return {
        success: true,
        isDeleted: true,
        error: 'Source returned 410 Gone',
      };
    }

    // Handle 404 - source no longer exists
    if (response.status === 404) {
      await markWebmentionDeleted(id);
      return {
        success: true,
        isDeleted: true,
        error: 'Source returned 404 Not Found',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch source: ${response.status}`,
      };
    }

    const html = await response.text();

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

    // Parse microformats
    const parsed = mf2(html, { baseUrl: sourceUrl });
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

    const author = await discoverAuthor(parsed, found, sourceUrl, options);

    // Extract content
    const content = extractContent(hEntry);

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
      publishedAt,
      rawMf2: hEntry,
    });

    return {
      success: true,
      type,
      ...(rsvp ? { rsvp } : {}),
      author,
      content,
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

function extractContent(hEntry: MicroformatRoot): string | undefined {
  const properties = hEntry.properties;

  // Try e-content first (HTML), then p-content (plain text), then p-summary
  const content =
    properties.content?.[0] || properties.summary?.[0] || properties.name?.[0];

  if (!content) return undefined;

  // If it's an object with html/value, prefer value (plain text) for safety
  if (typeof content === 'object' && content !== null && 'value' in content) {
    const text = content.value;
    if (typeof text === 'string') {
      // Sanitize any HTML
      return sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: {},
      }).slice(0, 500); // Limit length
    }
  }

  if (typeof content === 'string') {
    return sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {},
    }).slice(0, 500);
  }

  return undefined;
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
