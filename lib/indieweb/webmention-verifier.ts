import { mf2 } from 'microformats-parser';
import sanitizeHtml from 'sanitize-html';

import { SITE_URL } from '@/lib/indieweb/constants';
import type {
  ExtractedWebmentionAuthor,
  WebmentionType,
  WebmentionVerificationResult,
} from '@/lib/indieweb/types';
import { sameOrigin } from '@/lib/indieweb/utils';
import {
  getWebmentionBySourceTarget,
  markWebmentionDeleted,
  updateVerifiedWebmention,
} from '@/lib/indieweb/webmention-storage';

// Extract MicroformatRoot type from the mf2 return type
type ParsedDocument = ReturnType<typeof mf2>;
type MicroformatRoot = ParsedDocument['items'][number];

const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Verify a webmention by fetching the source and checking for a link to the target.
 */
export async function verifyWebmention(
  id: string,
  sourceUrl: string,
  targetUrl: string
): Promise<WebmentionVerificationResult> {
  try {
    // Validate URLs
    const source = new URL(sourceUrl);
    const target = new URL(targetUrl);

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
    if (!html.includes(targetUrl)) {
      // Also check for relative URLs or variations
      const targetPath = target.pathname;
      if (!html.includes(targetPath)) {
        // Source no longer links to target - this is a delete
        await markWebmentionDeleted(id);
        return {
          success: true,
          isDeleted: true,
          error: 'Source no longer links to target',
        };
      }
    }

    // Parse microformats
    const parsed = mf2(html, { baseUrl: sourceUrl });
    const hEntry = findHEntry(parsed.items);

    if (!hEntry) {
      // No h-entry found, but link exists - treat as simple mention
      await updateVerifiedWebmention(id, { type: 'mention' });
      return { success: true, type: 'mention' };
    }

    // Determine webmention type
    const type = determineWebmentionType(hEntry, targetUrl);

    // Extract author
    const author = extractAuthor(hEntry);

    // Extract content
    const content = extractContent(hEntry);

    // Extract published date
    const publishedAt = extractPublishedDate(hEntry);

    // Update the webmention record
    await updateVerifiedWebmention(id, {
      type,
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
      author,
      content,
      publishedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

function findHEntry(items: MicroformatRoot[]): MicroformatRoot | null {
  for (const item of items) {
    if (item.type?.includes('h-entry')) {
      return item;
    }
    // Check nested children
    if (item.children) {
      const nested = findHEntry(item.children);
      if (nested) return nested;
    }
  }
  return null;
}

function determineWebmentionType(
  hEntry: MicroformatRoot,
  targetUrl: string
): WebmentionType {
  const properties = hEntry.properties;

  // Check for specific interaction types
  if (properties['like-of']?.some((v) => String(v).includes(targetUrl))) {
    return 'like';
  }
  if (properties['repost-of']?.some((v) => String(v).includes(targetUrl))) {
    return 'repost';
  }
  if (properties['in-reply-to']?.some((v) => String(v).includes(targetUrl))) {
    return 'reply';
  }
  if (properties['bookmark-of']?.some((v) => String(v).includes(targetUrl))) {
    return 'bookmark';
  }

  return 'mention';
}

function extractAuthor(hEntry: MicroformatRoot): ExtractedWebmentionAuthor {
  const properties = hEntry.properties;
  const authorProp = properties.author?.[0];
  if (!authorProp) return {};

  // Author might be a string (just a name) or an h-card object
  if (typeof authorProp === 'string') {
    return { name: authorProp };
  }

  // Check if it's a nested MicroformatRoot (h-card)
  if (typeof authorProp === 'object' && 'properties' in authorProp) {
    const authorProps = authorProp.properties;
    const getName = (val: unknown): string | undefined =>
      typeof val === 'string' ? val : undefined;

    return {
      name: getName(authorProps.name?.[0]),
      url: getName(authorProps.url?.[0]),
      photo: getName(authorProps.photo?.[0]),
    };
  }

  return {};
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
