import { sql } from '@vercel/postgres';
import { mf2 } from 'microformats-parser';

import { SITE_URL } from '@/lib/indieweb/constants';

/**
 * Rich context data for a reply/interaction target.
 */
export interface ReplyContext {
  /** The target URL */
  url: string;
  /** Author name from the page */
  authorName?: string;
  /** Author URL */
  authorUrl?: string;
  /** Author avatar/photo */
  authorPhoto?: string;
  /** Post/page title */
  title?: string;
  /** Content preview (first ~280 chars) */
  contentPreview?: string;
  /** When the target was published */
  publishedAt?: Date;
  /** Name of the site/platform */
  siteName?: string;
  /** When this context was fetched */
  fetchedAt: Date;
}

/**
 * Initialize the reply context cache table.
 * This should be run during database setup/migrations.
 */
export async function initializeReplyContextTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS reply_context_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      target_url TEXT NOT NULL UNIQUE,
      author_name TEXT,
      author_url TEXT,
      author_photo TEXT,
      title TEXT,
      content_preview TEXT,
      published_at TIMESTAMPTZ,
      site_name TEXT,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      raw_mf2_json JSONB
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reply_context_url
    ON reply_context_cache(target_url)
  `;
}

/**
 * Get cached reply context for a URL.
 * Returns null if not cached or cache is stale (older than 7 days).
 */
export async function getCachedReplyContext(
  url: string,
  maxAgeHours = 168 // 7 days default
): Promise<ReplyContext | null> {
  if (!process.env.POSTGRES_URL) return null;
  const result = await sql`
    SELECT
      target_url,
      author_name,
      author_url,
      author_photo,
      title,
      content_preview,
      published_at,
      site_name,
      fetched_at
    FROM reply_context_cache
    WHERE target_url = ${url}
      AND fetched_at > NOW() - INTERVAL '1 hour' * ${maxAgeHours}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    url: row.target_url,
    authorName: row.author_name || undefined,
    authorUrl: row.author_url || undefined,
    authorPhoto: row.author_photo || undefined,
    title: row.title || undefined,
    contentPreview: row.content_preview || undefined,
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    siteName: row.site_name || undefined,
    fetchedAt: new Date(row.fetched_at),
  };
}

/**
 * Store reply context in the cache.
 */
export async function cacheReplyContext(
  context: ReplyContext,
  rawMf2?: object
): Promise<void> {
  if (!process.env.POSTGRES_URL) return;
  await sql`
    INSERT INTO reply_context_cache (
      target_url,
      author_name,
      author_url,
      author_photo,
      title,
      content_preview,
      published_at,
      site_name,
      fetched_at,
      raw_mf2_json
    ) VALUES (
      ${context.url},
      ${context.authorName || null},
      ${context.authorUrl || null},
      ${context.authorPhoto || null},
      ${context.title || null},
      ${context.contentPreview || null},
      ${context.publishedAt?.toISOString() || null},
      ${context.siteName || null},
      NOW(),
      ${JSON.stringify(rawMf2 || {})}
    )
    ON CONFLICT (target_url) DO UPDATE SET
      author_name = EXCLUDED.author_name,
      author_url = EXCLUDED.author_url,
      author_photo = EXCLUDED.author_photo,
      title = EXCLUDED.title,
      content_preview = EXCLUDED.content_preview,
      published_at = EXCLUDED.published_at,
      site_name = EXCLUDED.site_name,
      fetched_at = NOW(),
      raw_mf2_json = EXCLUDED.raw_mf2_json
  `;
}

/**
 * Extract site name from HTML meta tags or URL.
 */
function extractSiteName(html: string, url: string): string | undefined {
  // Try og:site_name
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogMatch) return cleanMetaText(ogMatch[1]);

  // Try twitter:site
  const twitterMatch = html.match(
    /<meta[^>]*name=["']twitter:site["'][^>]*content=["']@?([^"']+)["']/i
  );
  if (twitterMatch) return cleanMetaText(twitterMatch[1]);

  // Fall back to hostname
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Extract page title from HTML.
 */
function extractTitle(html: string): string | undefined {
  // Try og:title first
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogMatch) return cleanMetaText(ogMatch[1]);

  // Try twitter:title
  const twitterMatch = html.match(
    /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i
  );
  if (twitterMatch) return cleanMetaText(twitterMatch[1]);

  // Fall back to <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return cleanMetaText(titleMatch[1]);

  return undefined;
}

/**
 * Extract description/content preview from HTML meta tags.
 */
function extractDescription(html: string): string | undefined {
  // Try og:description
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogMatch) return cleanMetaText(ogMatch[1]);

  // Try meta description
  const metaMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  if (metaMatch) return cleanMetaText(metaMatch[1]);

  return undefined;
}

/**
 * Fetch and parse reply context from a URL.
 * Reads the first h-entry, then fills the gaps from Open Graph and meta tags.
 */
export async function fetchReplyContext(url: string): Promise<ReplyContext> {
  // First check cache
  const cached = await getCachedReplyContext(url);
  if (cached) {
    return cached;
  }

  let context: ReplyContext = {
    url,
    fetchedAt: new Date(),
  };

  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': `${new URL(SITE_URL).hostname} reply-context fetcher (+${SITE_URL})`,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      // Still cache the minimal context to avoid repeated failed fetches
      await cacheReplyContext(context);
      return context;
    }

    const html = await response.text();

    let mf2Context: Partial<ReplyContext> = {};
    try {
      mf2Context = extractMicroformats(html, url);
    } catch {
      // A page the parser cannot read still gets the meta tag fallbacks.
    }
    context = { ...context, ...mf2Context };

    // Fill in missing fields from meta tags
    if (!context.title) {
      context.title = extractTitle(html);
    }
    if (!context.contentPreview) {
      context.contentPreview = extractDescription(html);
    }
    if (!context.siteName) {
      context.siteName = extractSiteName(html, url);
    }

    // Cache the result
    await cacheReplyContext(context, mf2Context);

    return context;
  } catch (error) {
    console.error(`Failed to fetch reply context for ${url}:`, error);
    // Cache minimal context on error
    await cacheReplyContext(context);
    return context;
  }
}

const PREVIEW_LENGTH = 280;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
};

/**
 * Meta tag content arrives HTML-escaped, and pages such as MediaWiki put
 * line breaks in it as `&#10;`. Decode the entities a meta tag can carry
 * and fold the whitespace so the text reads as one line.
 */
export function cleanMetaText(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const decoded = raw.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] === '#') {
        const code =
          entity[1] === 'x' || entity[1] === 'X'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    }
  );
  const text = decoded.replace(/\s+/g, ' ').trim();
  return text || undefined;
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LENGTH
    ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…`
    : flat;
}

function firstString(values: unknown[] | undefined): string | undefined {
  const value = values?.[0];
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value?: unknown }).value;
    if (typeof inner === 'string') return inner;
  }
  return undefined;
}

/**
 * Read the first h-entry on the page with the microformats parser, which
 * decodes entities and resolves relative URLs. Only the entry's own
 * author counts: wiki pages nest contributor h-cards as children, and
 * those are not who wrote the entry.
 */
export function extractMicroformats(
  html: string,
  url: string
): Partial<ReplyContext> {
  const context: Partial<ReplyContext> = {};
  const entry = mf2(html, { baseUrl: url }).items.find((item) =>
    item.type?.includes('h-entry')
  );
  if (!entry) return context;
  const props = entry.properties;

  const name = firstString(props.name);
  if (name) context.title = name.replace(/\s+/g, ' ').trim();

  const body = firstString(props.summary) ?? firstString(props.content);
  if (body) context.contentPreview = preview(body);

  const published = firstString(props.published);
  if (published) {
    const date = new Date(published);
    if (!Number.isNaN(date.getTime())) context.publishedAt = date;
  }

  const author = props.author?.[0];
  if (typeof author === 'string') {
    context.authorName = author;
  } else if (author && typeof author === 'object' && 'properties' in author) {
    const card = (author as { properties: Record<string, unknown[]> })
      .properties;
    context.authorName = firstString(card.name);
    context.authorUrl = firstString(card.url);
    context.authorPhoto = firstString(card.photo);
  }

  return context;
}

/**
 * Get reply context for a URL, using cache if available.
 * This is the main function to use for displaying reply context.
 */
export async function getReplyContext(url: string): Promise<ReplyContext> {
  return fetchReplyContext(url);
}

/**
 * Batch fetch reply contexts for multiple URLs.
 * Useful for build-time fetching of all interaction post targets.
 */
export async function batchFetchReplyContexts(
  urls: string[]
): Promise<Map<string, ReplyContext>> {
  const results = new Map<string, ReplyContext>();

  // Fetch in parallel with concurrency limit
  const CONCURRENCY = 5;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const contexts = await Promise.all(
      batch.map((url) =>
        fetchReplyContext(url).catch(() => ({ url, fetchedAt: new Date() }))
      )
    );
    contexts.forEach((ctx) => results.set(ctx.url, ctx));
  }

  return results;
}

/**
 * Clear stale reply context entries from the cache.
 */
export async function clearStaleContextCache(
  maxAgeHours = 168
): Promise<number> {
  const result = await sql`
    DELETE FROM reply_context_cache
    WHERE fetched_at < NOW() - INTERVAL '1 hour' * ${maxAgeHours}
    RETURNING id
  `;
  return result.rowCount || 0;
}
