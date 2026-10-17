import { sql } from '@/lib/db/postgres';
import type { VouchStore } from '@/lib/indieweb/vouch';
import type {
  PublicWebmention,
  PublicWebmentionResponse,
  UpdateVerifiedWebmentionData,
  Webmention,
  WebmentionAuthorBackfillStore,
  WebmentionGroup,
  WebmentionModerationStore,
  WebmentionRateLimitStore,
  WebmentionRow,
  WebmentionTargetRequest,
  WebmentionType,
} from '@/lib/indieweb/webmention/types';
import type { RSVPStatus } from '@/lib/writings/types';

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
      rsvp = ${data.rsvp ?? null},
      author_name = ${data.authorName || null},
      author_url = ${data.authorUrl || null},
      author_photo = ${data.authorPhoto || null},
      content = ${data.content || null},
      content_html = ${data.contentHtml || null},
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
async function approveWebmention(id: string): Promise<boolean> {
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
async function rejectWebmention(id: string): Promise<boolean> {
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
      rsvp,
      raw_mf2_json #>> '{properties,name,0}' AS name,
      content,
      content_html,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved,
      clock_timestamp() AS origin_read_at
    FROM webmentions
    WHERE source_url = ${sourceUrl}
      AND target_url = ${targetUrl}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return rowToWebmention(result.rows[0] as WebmentionRow);
}

/**
 * Get one webmention by id, whatever its state.
 */
export async function getWebmention(id: string): Promise<Webmention | null> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      rsvp,
      raw_mf2_json #>> '{properties,name,0}' AS name,
      content,
      content_html,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved
    FROM webmentions
    WHERE id = ${id}
  `;
  const [row] = result.rows;
  return row != null ? rowToWebmention(row as WebmentionRow) : null;
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
      rsvp,
      raw_mf2_json #>> '{properties,name,0}' AS name,
      content,
      content_html,
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
  return groupWebmentions(webmentions);
}

export function groupWebmentions(webmentions: Webmention[]): WebmentionGroup {
  return {
    likes: webmentions.filter((w) => w.type === 'like'),
    reposts: webmentions.filter((w) => w.type === 'repost'),
    replies: webmentions.filter((w) => w.type === 'reply'),
    mentions: webmentions.filter((w) => w.type === 'mention'),
    bookmarks: webmentions.filter((w) => w.type === 'bookmark'),
    rsvps: webmentions.filter((w) => w.type === 'rsvp'),
  };
}

/** One public read fills the shared R2 snapshot across all target pages. */
export async function listApprovedWebmentions(): Promise<Webmention[]> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      rsvp,
      raw_mf2_json #>> '{properties,name,0}' AS name,
      content,
      content_html,
      published_at,
      received_at,
      verified_at,
      is_verified,
      is_approved,
      clock_timestamp() AS origin_read_at
    FROM webmentions
    WHERE is_verified = TRUE
      AND is_approved = TRUE
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    ORDER BY published_at DESC NULLS LAST, received_at DESC
  `;
  // Hyperdrive does not invalidate cached SELECTs after moderation writes.
  // The volatile timestamp bypasses its query cache; R2 is the public cache.
  return rowsToWebmentions(result.rows);
}

/**
 * Get webmentions awaiting moderation: not yet approved and not rejected.
 * Unverified ones are listed too, though only verified ones can be approved.
 */
async function getPendingWebmentions(): Promise<Webmention[]> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      type,
      author_name,
      author_url,
      author_photo,
      rsvp,
      raw_mf2_json #>> '{properties,name,0}' AS name,
      content,
      content_html,
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
 * The Postgres-backed store `pnpm webmentions:backfill-authors` acts through.
 * It lists verified mentions with no author photo whose stored entry has
 * properties, and sets a photo only on a row that still has none.
 */
export const webmentionAuthorBackfillStore: WebmentionAuthorBackfillStore = {
  async listMissingPhotos() {
    const result = await sql`
      SELECT id, raw_mf2_json
      FROM webmentions
      WHERE is_verified = TRUE
        AND author_photo IS NULL
        AND jsonb_typeof(raw_mf2_json -> 'properties') = 'object'
      ORDER BY received_at
    `;
    return result.rows.map((row) => ({
      id: row.id,
      rawMf2: row.raw_mf2_json,
    }));
  },
  async setPhoto(id, photo) {
    const result = await sql`
      UPDATE webmentions
      SET author_photo = ${photo}
      WHERE id = ${id}
        AND author_photo IS NULL
    `;
    return (result.rowCount ?? 0) > 0;
  },
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
 * The Postgres-backed store a vouch is checked against. A source's domain is
 * compared the way `vouchDomain` compares it: lowercase, without a port or a
 * leading `www.`.
 */
export const webmentionVouchStore: VouchStore = {
  async hasApprovedSource(domain) {
    const result = await sql`
      SELECT 1
      FROM webmentions
      WHERE is_approved = TRUE
        AND (is_deleted IS NULL OR is_deleted = FALSE)
        AND regexp_replace(
          lower(substring(source_url from '^https?://(?:[^@/?#]*@)?([^/?#:]+)')),
          '^www\\.',
          ''
        ) = ${domain}
      LIMIT 1
    `;
    return result.rows.length > 0;
  },
  async acceptedTargets() {
    const result = await sql`
      SELECT DISTINCT target_url
      FROM outgoing_webmentions
      WHERE status = 'sent'
    `;
    return result.rows.map((row) => String(row.target_url));
  },
  async approveByVouch(id, vouchUrl) {
    const result = await sql`
      UPDATE webmentions
      SET is_approved = TRUE, vouch_url = ${vouchUrl}
      WHERE id = ${id}
        AND is_verified = TRUE
        AND is_approved = FALSE
        AND (is_deleted IS NULL OR is_deleted = FALSE)
    `;
    return (result.rowCount ?? 0) > 0;
  },
};

/**
 * The Postgres-backed window that keeps a post from sending salmentions more
 * than once per window. The claim is one upsert that only moves `sent_at`
 * forward when the window has passed, so two approvals racing on different
 * instances cannot both win it.
 */
export const salmentionStore = {
  async claim(slug: string, windowMs: number): Promise<boolean> {
    const result = await sql`
      INSERT INTO salmentions (post_slug, sent_at)
      VALUES (${slug}, NOW())
      ON CONFLICT (post_slug) DO UPDATE SET sent_at = NOW()
      WHERE salmentions.sent_at
        <= NOW() - ${windowMs}::integer * INTERVAL '1 millisecond'
      RETURNING post_slug
    `;
    return result.rows.length > 0;
  },
};

function rowsToWebmentions(rows: unknown[]): Webmention[] {
  return rows.map((row) => rowToWebmention(row as WebmentionRow));
}

function optionalTimestamp(value: string | Date | null): Date | undefined {
  return value === null || value === '' ? undefined : new Date(value);
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
    rsvp: (row.rsvp as RSVPStatus | null) ?? undefined,
    name: citedName(row.name, row.content),
    content: row.content ?? undefined,
    contentHtml: row.content_html ?? undefined,
    publishedAt: optionalTimestamp(row.published_at),
    receivedAt: new Date(row.received_at),
    verifiedAt: optionalTimestamp(row.verified_at),
    isVerified: row.is_verified,
    isApproved: row.is_approved,
  };
}

/**
 * The citing post's title. A note has no title of its own, but a parser
 * reads one from markup such as `p-name e-content` on the same element, and
 * that name is only the text again. A name that the text starts with, or
 * that starts with the text, is dropped so the text is not shown twice.
 */
function citedName(
  name: string | null,
  content: string | null
): string | undefined {
  const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
  const title = name ? squash(name) : '';
  if (!title) return undefined;
  const text = content ? squash(content) : '';
  if (text && (text.startsWith(title) || title.startsWith(text))) {
    return undefined;
  }
  return title;
}

export function buildPublicWebmentionResponse(
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
      rsvp: children.filter((mention) => mention.type === 'rsvp'),
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
    ...(webmention.rsvp ? { rsvp: webmention.rsvp } : {}),
    ...(webmention.name ? { name: webmention.name } : {}),
    content: webmention.content,
    published: webmention.publishedAt?.toISOString(),
    received: webmention.receivedAt.toISOString(),
    verified: webmention.verifiedAt?.toISOString(),
  };
}
