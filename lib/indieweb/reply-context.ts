import { sql } from '@vercel/postgres';

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
 * Parse microformats2 h-entry from HTML to extract reply context.
 */
function parseMf2Entry(mf2: Record<string, unknown>): Partial<ReplyContext> {
  const context: Partial<ReplyContext> = {};

  const items = mf2.items as Array<Record<string, unknown>> | undefined;
  if (!items || items.length === 0) return context;

  // Find h-entry
  const hEntry = items.find(
    (item) =>
      Array.isArray(item.type) && (item.type as string[]).includes('h-entry')
  );

  if (hEntry && hEntry.properties) {
    const props = hEntry.properties as Record<string, unknown[]>;

    // Get name/title
    if (props.name && props.name[0]) {
      context.title = String(props.name[0]);
    }

    // Get content preview
    if (props.content && props.content[0]) {
      const content = props.content[0] as
        | string
        | { value?: string; html?: string };
      const textContent =
        typeof content === 'string' ? content : content.value || '';
      context.contentPreview = textContent.slice(0, 280).trim();
      if (textContent.length > 280) {
        context.contentPreview += '...';
      }
    }

    // Get published date
    if (props.published && props.published[0]) {
      const pubDate = new Date(String(props.published[0]));
      if (!isNaN(pubDate.getTime())) {
        context.publishedAt = pubDate;
      }
    }

    // Get author
    if (props.author && props.author[0]) {
      const author = props.author[0] as
        | string
        | { type?: string[]; properties?: Record<string, unknown[]> };
      if (typeof author === 'string') {
        context.authorName = author;
      } else if (author.properties) {
        const authorProps = author.properties;
        if (authorProps.name && authorProps.name[0]) {
          context.authorName = String(authorProps.name[0]);
        }
        if (authorProps.url && authorProps.url[0]) {
          context.authorUrl = String(authorProps.url[0]);
        }
        if (authorProps.photo && authorProps.photo[0]) {
          context.authorPhoto = String(authorProps.photo[0]);
        }
      }
    }
  }

  return context;
}

/**
 * Extract site name from HTML meta tags or URL.
 */
function extractSiteName(html: string, url: string): string | undefined {
  // Try og:site_name
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogMatch) return ogMatch[1];

  // Try twitter:site
  const twitterMatch = html.match(
    /<meta[^>]*name=["']twitter:site["'][^>]*content=["']@?([^"']+)["']/i
  );
  if (twitterMatch) return twitterMatch[1];

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
  if (ogMatch) return ogMatch[1];

  // Try twitter:title
  const twitterMatch = html.match(
    /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i
  );
  if (twitterMatch) return twitterMatch[1];

  // Fall back to <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();

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
  if (ogMatch) return ogMatch[1];

  // Try meta description
  const metaMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  if (metaMatch) return metaMatch[1];

  return undefined;
}

/**
 * Fetch and parse reply context from a URL.
 * Uses microformats2 parsing with fallback to Open Graph/meta tags.
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
        'User-Agent':
          'williecubed.me reply-context fetcher (+https://williecubed.me)',
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

    // Try microformats2 parsing first
    const mf2Data: Record<string, unknown> | null = null;
    try {
      // Use a simple regex-based mf2 extraction for common patterns
      // In production, you'd want to use a proper mf2 parser like microformats-parser
      const mf2Context = extractMicroformats(html);
      if (
        mf2Context.authorName ||
        mf2Context.title ||
        mf2Context.contentPreview
      ) {
        context = { ...context, ...mf2Context };
      }
    } catch {
      // mf2 parsing failed, continue with fallbacks
    }

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
    await cacheReplyContext(context, mf2Data || undefined);

    return context;
  } catch (error) {
    console.error(`Failed to fetch reply context for ${url}:`, error);
    // Cache minimal context on error
    await cacheReplyContext(context);
    return context;
  }
}

/**
 * Simple microformats extraction from HTML.
 * Extracts h-entry data using regex patterns.
 */
function extractMicroformats(html: string): Partial<ReplyContext> {
  const context: Partial<ReplyContext> = {};

  // Look for h-entry patterns
  const hEntryMatch = html.match(
    /<[^>]*class="[^"]*h-entry[^"]*"[^>]*>([\s\S]*?)<\/(?:article|div)>/i
  );
  if (!hEntryMatch) return context;

  const hEntryHtml = hEntryMatch[0];

  // Extract p-name (title)
  const pNameMatch = hEntryHtml.match(
    /<[^>]*class="[^"]*p-name[^"]*"[^>]*>([^<]+)</i
  );
  if (pNameMatch) {
    context.title = pNameMatch[1].trim();
  }

  // Extract p-summary or e-content preview
  const summaryMatch = hEntryHtml.match(
    /<[^>]*class="[^"]*(?:p-summary|e-content)[^"]*"[^>]*>([^<]{1,300})/i
  );
  if (summaryMatch) {
    context.contentPreview = summaryMatch[1].trim().slice(0, 280);
    if (summaryMatch[1].length > 280) {
      context.contentPreview += '...';
    }
  }

  // Extract dt-published
  const pubMatch = hEntryHtml.match(
    /<time[^>]*class="[^"]*dt-published[^"]*"[^>]*datetime="([^"]+)"/i
  );
  if (pubMatch) {
    const pubDate = new Date(pubMatch[1]);
    if (!isNaN(pubDate.getTime())) {
      context.publishedAt = pubDate;
    }
  }

  // Extract author from h-card
  const authorMatch = hEntryHtml.match(
    /<[^>]*class="[^"]*(?:p-author|h-card)[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span|div)>/i
  );
  if (authorMatch) {
    const authorHtml = authorMatch[0];

    // Get author name
    const authorNameMatch =
      authorHtml.match(/<[^>]*class="[^"]*p-name[^"]*"[^>]*>([^<]+)</i) ||
      authorHtml.match(/>([^<]+)</);
    if (authorNameMatch) {
      context.authorName = authorNameMatch[1].trim();
    }

    // Get author URL
    const authorUrlMatch = authorHtml.match(/href="([^"]+)"/i);
    if (authorUrlMatch) {
      context.authorUrl = authorUrlMatch[1];
    }

    // Get author photo
    const photoMatch =
      authorHtml.match(
        /<img[^>]*class="[^"]*u-photo[^"]*"[^>]*src="([^"]+)"/i
      ) ||
      authorHtml.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*u-photo[^"]*"/i);
    if (photoMatch) {
      context.authorPhoto = photoMatch[1];
    }
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
