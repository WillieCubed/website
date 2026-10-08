/** Send after the deployed writing is publicly readable, never during build. */
import { createHash } from 'node:crypto';

import { absoluteUrl } from '../site';
import {
  sendWebmention,
  targetsForUpdatedPost,
  webmentionTargetsForWriting,
} from './send-webmention';
import type { WebmentionSourceWriting } from './types';

export interface WebmentionPublisherServices {
  getWritingSlugs(): Promise<string[]>;
  loadWriting(slug: string): Promise<{
    writing: WebmentionSourceWriting & { draft: boolean };
    content: string;
  }>;
  send: typeof sendWebmention;
}

function unchangedTerminalDelivery(
  previous: Readonly<Record<string, unknown>> | undefined,
  contentHash: string
): boolean {
  if (!previous || previous.content_hash !== contentHash) return false;
  if (previous.status === 'sent' || previous.status === 'no_endpoint')
    return true;
  const code = previous.response_code;
  return (
    previous.status === 'failed' &&
    typeof code === 'number' &&
    code >= 400 &&
    code < 500 &&
    ![408, 425, 429].includes(code)
  );
}

function deliveryStatus(result: Awaited<ReturnType<typeof sendWebmention>>) {
  return result.success
    ? 'sent'
    : result.error === 'No webmention endpoint found'
      ? 'no_endpoint'
      : 'failed';
}

export async function sendChangedWebmentions(
  services?: WebmentionPublisherServices
): Promise<{
  sent: number;
  failed: number;
  unsupported: number;
}> {
  if (process.env.SKIP_WEBMENTIONS === 'true')
    return { sent: 0, failed: 0, unsupported: 0 };
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    throw new Error('Webmention sending requires POSTGRES_URL.');
  }
  const { sql } = await import('@vercel/postgres');
  const { getWritingSlugs, loadWriting } =
    services ?? (await import('../writings'));
  const send = services?.send ?? sendWebmention;
  let sent = 0;
  let failed = 0;
  let unsupported = 0;
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
      SELECT target_url, content_hash, status, response_code FROM outgoing_webmentions
      WHERE post_slug = ${slug}
    `;
    const targets = targetsForUpdatedPost(
      currentTargets,
      previous.rows.map((row) => String(row.target_url))
    );

    for (const targetUrl of targets) {
      const old = previous.rows.find((row) => row.target_url === targetUrl);
      if (unchangedTerminalDelivery(old, contentHash)) {
        if (old?.status === 'no_endpoint') unsupported++;
        continue;
      }
      const result = await send(sourceUrl, targetUrl);
      const status = deliveryStatus(result);
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
      if (status === 'sent') sent++;
      else if (status === 'no_endpoint') unsupported++;
      else failed++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const former =
    await sql`SELECT source_url, target_url, post_slug, content_hash, status, response_code FROM outgoing_webmentions`;
  for (const row of former.rows) {
    if (published.has(String(row.post_slug))) continue;
    const hash = createHash('sha256')
      .update(`unpublished:${row.source_url}`)
      .digest('hex');
    if (unchangedTerminalDelivery(row, hash)) {
      if (row.status === 'no_endpoint') unsupported++;
      continue;
    }
    const result = await send(String(row.source_url), String(row.target_url));
    const status = deliveryStatus(result);
    await sql`UPDATE outgoing_webmentions SET content_hash = ${hash}, status = ${status}, endpoint_url = ${result.endpoint ?? null}, response_code = ${result.statusCode ?? null}, error_message = ${result.error ?? null}, sent_at = ${result.success ? new Date().toISOString() : null} WHERE source_url = ${row.source_url} AND target_url = ${row.target_url}`;
    if (status === 'sent') sent++;
    else if (status === 'no_endpoint') unsupported++;
    else failed++;
  }
  console.log(
    `Webmentions sent: ${sent}; failed: ${failed}; unsupported: ${unsupported}`
  );
  return { sent, failed, unsupported };
}
