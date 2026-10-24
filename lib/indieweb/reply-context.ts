import { mf2 } from 'microformats-parser';

import { hasDatabase, sql } from '@/lib/db/postgres';
import { fetchWithDeadline } from '@/lib/http/fetch';
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

interface ReplyContextRow {
  target_url: string;
  author_name: string | null;
  author_url: string | null;
  author_photo: string | null;
  title: string | null;
  content_preview: string | null;
  published_at: string | Date | null;
  site_name: string | null;
  fetched_at: string | Date;
}

/**
 * Get cached reply context for a URL.
 * Returns null if not cached or cache is stale (older than 7 days).
 */
async function getCachedReplyContext(
  url: string,
  maxAgeHours = 168 // 7 days default
): Promise<ReplyContext | null> {
  if (!hasDatabase()) return null;
  const result = await sql.query<ReplyContextRow>(
    `
    SELECT ${cacheColumns.filter((column) => column !== 'raw_mf2_json').join(', ')}
    FROM reply_context_cache
    WHERE target_url = $1
      AND fetched_at > NOW() - INTERVAL '1 hour' * $2
  `,
    [url, maxAgeHours]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return contextFromRow(result.rows[0]);
}

const cacheColumns = [
  'target_url',
  'author_name',
  'author_url',
  'author_photo',
  'title',
  'content_preview',
  'published_at',
  'site_name',
  'raw_mf2_json',
  'fetched_at',
];

async function cacheReplyContext(
  context: ReplyContext,
  rawMf2?: object
): Promise<void> {
  if (!hasDatabase()) return;
  const values = [
    context.url,
    ...[
      context.authorName,
      context.authorUrl,
      context.authorPhoto,
      context.title,
      context.contentPreview,
    ].map((value) => value || null),
    context.publishedAt?.toISOString() || null,
    context.siteName || null,
    JSON.stringify(rawMf2 || {}),
  ];
  await sql.query(
    `
    INSERT INTO reply_context_cache (${cacheColumns.join(', ')})
    VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')}, NOW())
    ON CONFLICT (target_url) DO UPDATE SET
      ${cacheColumns
        .slice(1)
        .map((column) => `${column} = EXCLUDED.${column}`)
        .join(', ')}
  `,
    values
  );
}

const metadataPatterns = {
  title: [
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ],
  contentPreview: [
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
  ],
  siteName: [
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']twitter:site["'][^>]*content=["']@?([^"']+)["']/i,
  ],
};

function metadataValue(html: string, field: keyof typeof metadataPatterns) {
  // A matching blank value blocks lower-priority tags even after cleanup.
  return metadataPatterns[field]
    .map((pattern) => html.match(pattern))
    .find(Boolean)?.[1];
}

function extractSiteName(html: string, url: string): string | undefined {
  const value = metadataValue(html, 'siteName');
  if (value !== undefined) return cleanMetaText(value);
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Get reply context for a URL, using the cache when it is fresh.
 * Reads the first h-entry, then fills the gaps from Open Graph and meta tags.
 */
export async function getReplyContext(url: string): Promise<ReplyContext> {
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
    const response = await fetchWithDeadline(
      url,
      {
        headers: {
          'User-Agent': `${new URL(SITE_URL).hostname} reply-context fetcher (+${SITE_URL})`,
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      },
      1500
    );

    let mf2Context: Partial<ReplyContext> = {};
    if (response.ok) {
      const html = await response.text();
      try {
        mf2Context = extractMicroformats(html, url);
      } catch {
        // A page the parser cannot read still gets the meta tag fallbacks.
      }
      context = { ...context, ...mf2Context };
      context.title ||= cleanMetaText(metadataValue(html, 'title'));
      context.contentPreview ||= cleanMetaText(
        metadataValue(html, 'contentPreview')
      );
      context.siteName ||= extractSiteName(html, url);
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
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
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

  Object.assign(context, authorContext(props.author?.[0]));

  return context;
}

function contextFromRow(row: ReplyContextRow): ReplyContext {
  return {
    url: row.target_url,
    authorName: row.author_name || undefined,
    authorUrl: row.author_url || undefined,
    authorPhoto: row.author_photo || undefined,
    title: row.title || undefined,
    contentPreview: row.content_preview || undefined,
    publishedAt:
      row.published_at !== null && row.published_at !== ''
        ? new Date(row.published_at)
        : undefined,
    siteName: row.site_name || undefined,
    fetchedAt: new Date(row.fetched_at),
  };
}

function authorContext(author: unknown): Partial<ReplyContext> {
  const context: Partial<ReplyContext> = {};
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
