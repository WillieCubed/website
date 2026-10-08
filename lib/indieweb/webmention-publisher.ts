/** Send after the deployed writing is publicly readable, never during build. */
import { createHash } from 'node:crypto';

import { absoluteUrl } from '../site';
import {
  sendWebmention,
  targetsForUpdatedPost,
  webmentionTargetsForWriting,
} from './send-webmention';

export async function sendChangedWebmentions(): Promise<{
  sent: number;
  failed: number;
}> {
  if (process.env.SKIP_WEBMENTIONS === 'true') return { sent: 0, failed: 0 };
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    throw new Error('Webmention sending requires POSTGRES_URL.');
  }
  const { sql } = await import('@vercel/postgres');
  const { getWritingSlugs, loadWriting } = await import('../writings');
  let sent = 0;
  let failed = 0;
  const published = new Set<string>();
  for (const slug of await getWritingSlugs()) {
    const { writing, content } = await loadWriting(slug);
    if (writing.draft) continue;
    published.add(slug);

    const sourceUrl = absoluteUrl(`/writings/${slug}`);
    const currentTargets = webmentionTargetsForWriting(writing, content);
    const contentHash = createHash('sha256')
      .update(JSON.stringify({ content, currentTargets }))
      .digest('hex');
    const previous = await sql`
      SELECT target_url, content_hash, status FROM outgoing_webmentions
      WHERE post_slug = ${slug}
    `;
    const targets = targetsForUpdatedPost(
      currentTargets,
      previous.rows.map((row) => String(row.target_url))
    );

    for (const targetUrl of targets) {
      const old = previous.rows.find((row) => row.target_url === targetUrl);
      if (old?.content_hash === contentHash && old.status === 'sent') continue;
      const result = await sendWebmention(sourceUrl, targetUrl);
      const status = result.success
        ? 'sent'
        : result.error === 'No webmention endpoint found'
          ? 'no_endpoint'
          : 'failed';
      await sql`
        INSERT INTO outgoing_webmentions
          (source_url, target_url, post_slug, content_hash, status, endpoint_url,
           response_code, error_message, sent_at)
        VALUES
          (${sourceUrl}, ${targetUrl}, ${slug}, ${contentHash}, ${status},
           ${result.endpoint ?? null}, ${result.statusCode ?? null},
           ${result.error ?? null}, ${result.success ? new Date().toISOString() : null})
        ON CONFLICT (source_url, target_url) DO UPDATE SET
          content_hash = EXCLUDED.content_hash,
          status = EXCLUDED.status,
          endpoint_url = EXCLUDED.endpoint_url,
          response_code = EXCLUDED.response_code,
          error_message = EXCLUDED.error_message,
          sent_at = EXCLUDED.sent_at
      `;
      if (result.success) sent++;
      else failed++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const former =
    await sql`SELECT source_url, target_url, post_slug, content_hash, status FROM outgoing_webmentions`;
  for (const row of former.rows) {
    if (published.has(String(row.post_slug))) continue;
    const hash = createHash('sha256')
      .update(`unpublished:${row.source_url}`)
      .digest('hex');
    if (row.content_hash === hash && row.status === 'sent') continue;
    const result = await sendWebmention(
      String(row.source_url),
      String(row.target_url)
    );
    await sql`UPDATE outgoing_webmentions SET content_hash = ${hash}, status = ${result.success ? 'sent' : 'failed'}, endpoint_url = ${result.endpoint ?? null}, response_code = ${result.statusCode ?? null}, error_message = ${result.error ?? null}, sent_at = ${result.success ? new Date().toISOString() : null} WHERE source_url = ${row.source_url} AND target_url = ${row.target_url}`;
    if (result.success) sent++;
    else failed++;
  }
  console.log(`Webmentions sent: ${sent}; failed: ${failed}`);
  return { sent, failed };
}
