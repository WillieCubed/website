import { sql } from '@vercel/postgres';

import {
  extractWritingSlugFromTarget,
  getActivityDate,
  sortWebmentionActivities,
} from '@/lib/indieweb/activity-feed';
import type {
  GetAllWebmentionActivitiesOptions,
  PublicWebmention,
  PublicWebmentionResponse,
  UpdateVerifiedWebmentionData,
  Webmention,
  WebmentionActivity,
  WebmentionGroup,
  WebmentionModerationStore,
  WebmentionRateLimitStore,
  WebmentionRow,
  WebmentionTargetRequest,
  WebmentionType,
} from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const SITE_URL = site.origin;

/**
 * Initialize the webmentions table if it doesn't exist.
 * Run this once during setup or as a migration.
 */
export async function initializeWebmentionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS webmentions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_url TEXT NOT NULL,
      target_url TEXT NOT NULL,
      type TEXT,
      author_name TEXT,
      author_url TEXT,
      author_photo TEXT,
      content TEXT,
      published_at TIMESTAMPTZ,
      received_at TIMESTAMPTZ DEFAULT NOW(),
      verified_at TIMESTAMPTZ,
      is_verified BOOLEAN DEFAULT FALSE,
      is_approved BOOLEAN DEFAULT FALSE,
      raw_mf2_json JSONB,
      UNIQUE(source_url, target_url)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webmentions_target
    ON webmentions(target_url)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webmentions_verified
    ON webmentions(is_verified, is_approved)
  `;

  await initializeWebmentionRateLimitTable();
}

/**
 * Initialize the table that counts requests to the receiving endpoint. Also
 * in `lib/db/migrations/002_webmention_rate_limits.sql` for databases that
 * already have the webmentions table.
 */
export async function initializeWebmentionRateLimitTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS webmention_rate_limits (
      key TEXT PRIMARY KEY,
      window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hits INTEGER NOT NULL DEFAULT 1
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webmention_rate_limits_window
    ON webmention_rate_limits(window_start)
  `;
}

/**
 * Store a new webmention (unverified).
 */
export async function storeWebmention(
  sourceUrl: string,
  targetUrl: string
): Promise<string> {
  const result = await sql`
    INSERT INTO webmentions (source_url, target_url)
    VALUES (${sourceUrl}, ${targetUrl})
    ON CONFLICT (source_url, target_url)
    DO UPDATE SET received_at = NOW()
    RETURNING id
  `;
  return result.rows[0].id;
}

/**
 * Update a webmention after verification.
 */
export async function updateVerifiedWebmention(
  id: string,
  data: UpdateVerifiedWebmentionData
): Promise<void> {
  await sql`
    UPDATE webmentions
    SET
      type = ${data.type},
      author_name = ${data.authorName || null},
      author_url = ${data.authorUrl || null},
      author_photo = ${data.authorPhoto || null},
      content = ${data.content || null},
      published_at = ${data.publishedAt?.toISOString() || null},
      verified_at = NOW(),
      is_verified = TRUE,
      raw_mf2_json = ${JSON.stringify(data.rawMf2 || {})}
    WHERE id = ${id}
  `;
}

/**
 * Approve a verified webmention for display. Resolves to false when the id
 * names no verified, unrejected webmention.
 */
export async function approveWebmention(id: string): Promise<boolean> {
  const result = await sql`
    UPDATE webmentions
    SET is_approved = TRUE
    WHERE id = ${id}
      AND is_verified = TRUE
      AND (is_deleted IS NULL OR is_deleted = FALSE)
  `;
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete a webmention.
 */
export async function deleteWebmention(id: string): Promise<void> {
  await sql`
    DELETE FROM webmentions
    WHERE id = ${id}
  `;
}

/**
 * Mark a webmention as deleted (soft delete).
 * Used when the source no longer links to the target.
 */
export async function markWebmentionDeleted(id: string): Promise<void> {
  await sql`
    UPDATE webmentions
    SET is_deleted = TRUE, deleted_at = NOW(), is_approved = FALSE
    WHERE id = ${id}
  `;
}

/**
 * Reject a webmention without removing the row, so a resent mention from the
 * same source stays hidden. Resolves to false when the id names no webmention
 * that is still live.
 */
export async function rejectWebmention(id: string): Promise<boolean> {
  const result = await sql`
    UPDATE webmentions
    SET is_deleted = TRUE, deleted_at = NOW(), is_approved = FALSE
    WHERE id = ${id}
      AND (is_deleted IS NULL OR is_deleted = FALSE)
  `;
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get source and target URLs for a webmention.
 */
export async function getWebmentionTargetRequest(
  id: string
): Promise<WebmentionTargetRequest | null> {
  const result = await sql`
    SELECT source_url, target_url
    FROM webmentions
    WHERE id = ${id}
  `;

  if (result.rows.length === 0) return null;

  return {
    sourceUrl: result.rows[0].source_url,
    targetUrl: result.rows[0].target_url,
  };
}

/**
 * Get a webmention by source and target URL.
 */
export async function getWebmentionBySourceTarget(
  sourceUrl: string,
  targetUrl: string
): Promise<Webmention | null> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      content,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved
    FROM webmentions
    WHERE source_url = ${sourceUrl}
      AND target_url = ${targetUrl}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    sourceUrl: row.source_url,
    targetUrl: row.target_url,
    type: row.type as WebmentionType,
    author: {
      name: row.author_name,
      url: row.author_url,
      photo: row.author_photo,
    },
    content: row.content,
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    receivedAt: new Date(row.received_at),
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    isVerified: row.is_verified,
    isApproved: row.is_approved,
  };
}

/**
 * Get all verified and approved webmentions for a post.
 */
export async function getWebmentionsForPost(
  slug: string
): Promise<WebmentionGroup> {
  return getWebmentionsForTarget(`${SITE_URL}/writings/${slug}`);
}

/**
 * Get all verified and approved webmentions for any page, by its canonical
 * address, grouped by kind.
 */
export async function getWebmentionsForTarget(
  targetUrl: string
): Promise<WebmentionGroup> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      content,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved
    FROM webmentions
    WHERE target_url = ${targetUrl}
      AND is_verified = TRUE
      AND is_approved = TRUE
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    ORDER BY published_at DESC NULLS LAST, received_at DESC
  `;

  const webmentions = rowsToWebmentions(result.rows);

  return {
    likes: webmentions.filter((w) => w.type === 'like'),
    reposts: webmentions.filter((w) => w.type === 'repost'),
    replies: webmentions.filter((w) => w.type === 'reply'),
    mentions: webmentions.filter((w) => w.type === 'mention'),
    bookmarks: webmentions.filter((w) => w.type === 'bookmark'),
  };
}

/**
 * Get all verified and approved webmention activities for a post.
 */
export async function getWebmentionActivitiesForPost(
  slug: string
): Promise<WebmentionActivity[]> {
  const group = await getWebmentionsForPost(slug);
  return sortWebmentionActivities(
    [
      ...group.likes,
      ...group.reposts,
      ...group.replies,
      ...group.mentions,
      ...group.bookmarks,
    ].map(toWebmentionActivity)
  );
}

/**
 * Get recent verified and approved webmention activities across all writings.
 */
export async function getAllWebmentionActivities({
  limit = 100,
}: GetAllWebmentionActivitiesOptions = {}): Promise<WebmentionActivity[]> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      content,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved
    FROM webmentions
    WHERE is_verified = TRUE
      AND is_approved = TRUE
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    ORDER BY published_at DESC NULLS LAST, received_at DESC
    LIMIT ${limit}
  `;

  return sortWebmentionActivities(
    rowsToWebmentions(result.rows).map(toWebmentionActivity)
  );
}

/**
 * Get webmentions awaiting moderation: not yet approved and not rejected.
 * Unverified ones are listed too, though only verified ones can be approved.
 */
export async function getPendingWebmentions(): Promise<Webmention[]> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      content,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved
    FROM webmentions
    WHERE is_approved = FALSE
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    ORDER BY received_at DESC
  `;

  return rowsToWebmentions(result.rows);
}

/**
 * The Postgres-backed store the moderation route and CLI act through.
 */
export const webmentionModerationStore: WebmentionModerationStore = {
  listPending: getPendingWebmentions,
  approve: approveWebmention,
  reject: rejectWebmention,
};

/**
 * The Postgres-backed store the receiving endpoint's rate limit counts in.
 * `hit` is one upsert, so concurrent requests on different instances each
 * see their own increment: the row lock serializes them, and a window that
 * has ended restarts at 1.
 */
export const webmentionRateLimitStore: WebmentionRateLimitStore = {
  async hit(key, windowMs) {
    const result = await sql`
      INSERT INTO webmention_rate_limits (key, window_start, hits)
      VALUES (${key}, NOW(), 1)
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE
          WHEN webmention_rate_limits.window_start
            <= NOW() - ${windowMs}::integer * INTERVAL '1 millisecond'
          THEN 1
          ELSE webmention_rate_limits.hits + 1
        END,
        window_start = CASE
          WHEN webmention_rate_limits.window_start
            <= NOW() - ${windowMs}::integer * INTERVAL '1 millisecond'
          THEN NOW()
          ELSE webmention_rate_limits.window_start
        END
      RETURNING hits
    `;
    return Number(result.rows[0].hits);
  },
  async prune(windowMs) {
    await sql`
      DELETE FROM webmention_rate_limits
      WHERE window_start
        <= NOW() - ${windowMs}::integer * INTERVAL '1 millisecond'
    `;
  },
};

/**
 * Get public, grouped webmentions for any approved target on this site.
 */
export async function getPublicWebmentionsForTarget(
  targetUrl: string
): Promise<PublicWebmentionResponse> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      content,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved
    FROM webmentions
    WHERE target_url = ${targetUrl}
      AND is_verified = TRUE
      AND is_approved = TRUE
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    ORDER BY published_at DESC NULLS LAST, received_at DESC
  `;

  return buildPublicWebmentionResponse(
    targetUrl,
    rowsToWebmentions(result.rows)
  );
}

function rowsToWebmentions(rows: unknown[]): Webmention[] {
  return rows.map((row) => rowToWebmention(row as WebmentionRow));
}

function rowToWebmention(row: WebmentionRow): Webmention {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    targetUrl: row.target_url,
    type: (row.type as WebmentionType) || 'mention',
    author: {
      name: row.author_name ?? undefined,
      url: row.author_url ?? undefined,
      photo: row.author_photo ?? undefined,
    },
    content: row.content ?? undefined,
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    receivedAt: new Date(row.received_at),
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    isVerified: row.is_verified,
    isApproved: row.is_approved,
  };
}

function toWebmentionActivity(webmention: Webmention): WebmentionActivity {
  return {
    ...webmention,
    activityDate: getActivityDate(webmention),
    targetSlug: extractWritingSlugFromTarget(webmention.targetUrl) ?? undefined,
  };
}

function buildPublicWebmentionResponse(
  targetUrl: string,
  webmentions: Webmention[]
): PublicWebmentionResponse {
  const children = webmentions.map(toPublicWebmention);
  return {
    type: 'webmentions',
    target: targetUrl,
    count: children.length,
    children,
    byType: {
      like: children.filter((mention) => mention.type === 'like'),
      repost: children.filter((mention) => mention.type === 'repost'),
      reply: children.filter((mention) => mention.type === 'reply'),
      mention: children.filter((mention) => mention.type === 'mention'),
      bookmark: children.filter((mention) => mention.type === 'bookmark'),
    },
  };
}

function toPublicWebmention(webmention: Webmention): PublicWebmention {
  return {
    id: webmention.id,
    source: webmention.sourceUrl,
    target: webmention.targetUrl,
    type: webmention.type,
    author: webmention.author,
    content: webmention.content,
    published: webmention.publishedAt?.toISOString(),
    received: webmention.receivedAt.toISOString(),
    verified: webmention.verifiedAt?.toISOString(),
  };
}
