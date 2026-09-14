import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';

import type {
  OutgoingWebmentionRecord,
  PendingOutgoingWebmention,
} from '@/lib/indieweb/types';

/**
 * Create a hash of content for change detection.
 * Uses SHA-256 for consistent hashing.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get the stored content hash for a post.
 */
export async function getStoredHash(slug: string): Promise<string | null> {
  const result = await sql`
    SELECT content_hash
    FROM outgoing_webmentions
    WHERE post_slug = ${slug}
    LIMIT 1
  `;

  return result.rows[0]?.content_hash || null;
}

/**
 * Check if content has changed since last webmention send.
 */
export async function hasContentChanged(
  slug: string,
  currentContent: string
): Promise<boolean> {
  const storedHash = await getStoredHash(slug);
  if (!storedHash) {
    // Never sent webmentions for this post
    return true;
  }

  const currentHash = hashContent(currentContent);
  return storedHash !== currentHash;
}

/**
 * Track a sent outgoing webmention.
 */
export async function trackOutgoingWebmention(
  sourceUrl: string,
  targetUrl: string,
  postSlug: string,
  contentHash: string,
  status: 'pending' | 'sent' | 'failed' | 'no_endpoint' = 'pending'
): Promise<string> {
  const result = await sql`
    INSERT INTO outgoing_webmentions (
      source_url,
      target_url,
      post_slug,
      content_hash,
      status,
      sent_at
    ) VALUES (
      ${sourceUrl},
      ${targetUrl},
      ${postSlug},
      ${contentHash},
      ${status},
      ${status === 'sent' ? new Date().toISOString() : null}
    )
    ON CONFLICT (source_url, target_url) DO UPDATE SET
      content_hash = EXCLUDED.content_hash,
      status = EXCLUDED.status,
      sent_at = CASE
        WHEN EXCLUDED.status = 'sent' THEN NOW()
        ELSE outgoing_webmentions.sent_at
      END
    RETURNING id
  `;

  return result.rows[0].id;
}

/**
 * Get all outgoing webmentions for a post.
 */
export async function getOutgoingWebmentions(
  slug: string
): Promise<OutgoingWebmentionRecord[]> {
  const result = await sql`
    SELECT
      id,
      source_url,
      target_url,
      content_hash,
      status,
      sent_at
    FROM outgoing_webmentions
    WHERE post_slug = ${slug}
    ORDER BY created_at DESC
  `;

  return result.rows.map((row) => ({
    id: row.id,
    sourceUrl: row.source_url,
    targetUrl: row.target_url,
    contentHash: row.content_hash,
    status: row.status,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
  }));
}

/**
 * Update the status of an outgoing webmention.
 */
export async function updateOutgoingWebmentionStatus(
  id: string,
  status: 'pending' | 'sent' | 'failed' | 'no_endpoint'
): Promise<void> {
  if (status === 'sent') {
    await sql`
      UPDATE outgoing_webmentions
      SET status = ${status}, sent_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE outgoing_webmentions
      SET status = ${status}
      WHERE id = ${id}
    `;
  }
}

/**
 * Get pending webmentions that need to be sent.
 */
export async function getPendingOutgoingWebmentions(): Promise<
  PendingOutgoingWebmention[]
> {
  const result = await sql`
    SELECT id, source_url, target_url, post_slug
    FROM outgoing_webmentions
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `;

  return result.rows.map((row) => ({
    id: row.id,
    sourceUrl: row.source_url,
    targetUrl: row.target_url,
    postSlug: row.post_slug,
  }));
}

/**
 * Mark a post's webmentions for re-sending (e.g., after content update).
 */
export async function markForResend(slug: string): Promise<number> {
  const result = await sql`
    UPDATE outgoing_webmentions
    SET status = 'pending'
    WHERE post_slug = ${slug}
    AND status = 'sent'
    RETURNING id
  `;

  return result.rowCount || 0;
}

/**
 * Delete tracking entries for a removed post.
 */
export async function deleteOutgoingWebmentions(slug: string): Promise<number> {
  const result = await sql`
    DELETE FROM outgoing_webmentions
    WHERE post_slug = ${slug}
    RETURNING id
  `;

  return result.rowCount || 0;
}
