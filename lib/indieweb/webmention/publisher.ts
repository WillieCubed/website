/** Send after the deployed writing is publicly readable, never during build. */
import { createHash } from 'node:crypto';

import { hasDatabase } from '@/lib/db/postgres';
import { absoluteUrl } from '@/lib/site/urls';

import {
  sendWebmention,
  targetsForUpdatedPost,
  webmentionTargetsForWriting,
} from './send';
import type {
  WebmentionDeliveryStatus,
  WebmentionPublishResult,
  WebmentionSendResult,
  WebmentionSourceDocument,
  WebmentionSourceWriting,
} from './types';

export interface WebmentionPublisherServices {
  getWritingSlugs(): Promise<string[]>;
  loadWriting(slug: string): Promise<WebmentionSourceDocument>;
  send(sourceUrl: string, targetUrl: string): Promise<WebmentionSendResult>;
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

function deliveryStatus(
  result: WebmentionSendResult
): WebmentionDeliveryStatus {
  return result.success
    ? 'sent'
    : result.error === 'No webmention endpoint found'
      ? 'no_endpoint'
      : 'failed';
}

export async function sendChangedWebmentions(
  services?: WebmentionPublisherServices
): Promise<WebmentionPublishResult> {
  if (process.env.SKIP_WEBMENTIONS === 'true')
    return { sent: 0, failed: 0, unsupported: 0 };
  if (!hasDatabase()) {
    throw new Error('Webmention sending requires Postgres.');
  }
  const { sql } = await import('@/lib/db/postgres');
  const { getWritingSlugs, loadWriting } =
    services ?? (await import('../../writings/load'));
  const send = services?.send ?? sendWebmention;
  const counts = { sent: 0, failed: 0, unsupported: 0 };
  const published = new Set<string>();
  for (const slug of await getWritingSlugs()) {
    const { writing, content } = await loadWriting(slug);
    if (writing.draft) continue;
    published.add(slug);

    await publishWritingMentions({ sql, send, counts }, slug, writing, content);
  }
  const former =
    await sql<DeliveryRow>`SELECT source_url, target_url, post_slug, content_hash, status, response_code FROM outgoing_webmentions`;
  for (const row of former.rows) {
    if (!published.has(String(row.post_slug)))
      await deliverUnpublishedTarget({ sql, send, counts }, row);
  }
  console.log(
    `Webmentions sent: ${counts.sent}; failed: ${counts.failed}; unsupported: ${counts.unsupported}`
  );
  return counts;
}

type DeliveryContext = {
  sql: typeof import('@/lib/db/postgres').sql;
  send: WebmentionPublisherServices['send'];
  counts: WebmentionPublishResult;
};
interface DeliveryRow extends DeliveryState {
  source_url: string;
  post_slug: string;
}
interface DeliveryState extends Readonly<Record<string, unknown>> {
  target_url: string;
  content_hash: string;
  status: string;
  response_code: number | null;
}
async function publishWritingMentions(
  context: DeliveryContext,
  slug: string,
  writing: WebmentionSourceWriting,
  content: string
) {
  const { sql, send, counts } = context;
  const sourceUrl = absoluteUrl(`/writings/${slug}`);
  const currentTargets = webmentionTargetsForWriting(writing, content);
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ content, currentTargets }))
    .digest('hex');
  const previous = await sql<DeliveryState>`
      SELECT target_url, content_hash, status, response_code FROM outgoing_webmentions
      WHERE post_slug = ${slug}
    `;
  const targets = targetsForUpdatedPost(
    currentTargets,
    previous.rows.map((row) => String(row.target_url))
  );

  for (const targetUrl of targets) {
    await deliverPublishedTarget(
      { sql, send, counts },
      { sourceUrl, targetUrl, slug, contentHash },
      previous.rows.find((row) => row.target_url === targetUrl)
    );
  }
}
async function deliverPublishedTarget(
  { sql, send, counts }: DeliveryContext,
  {
    sourceUrl,
    targetUrl,
    slug,
    contentHash,
  }: {
    sourceUrl: string;
    targetUrl: string;
    slug: string;
    contentHash: string;
  },
  old?: DeliveryState
) {
  if (unchangedTerminalDelivery(old, contentHash)) {
    if (old?.status === 'no_endpoint') counts.unsupported++;
    return;
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
  countDelivery(counts, status);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
async function deliverUnpublishedTarget(
  { sql, send, counts }: DeliveryContext,
  row: DeliveryRow
) {
  const hash = createHash('sha256')
    .update(`unpublished:${row.source_url}`)
    .digest('hex');
  if (unchangedTerminalDelivery(row, hash)) {
    if (row.status === 'no_endpoint') counts.unsupported++;
    return;
  }
  const result = await send(String(row.source_url), String(row.target_url));
  const status = deliveryStatus(result);
  await sql`UPDATE outgoing_webmentions SET content_hash = ${hash}, status = ${status}, endpoint_url = ${result.endpoint ?? null}, response_code = ${result.statusCode ?? null}, error_message = ${result.error ?? null}, sent_at = ${result.success ? new Date().toISOString() : null} WHERE source_url = ${row.source_url} AND target_url = ${row.target_url}`;
  countDelivery(counts, status);
}
function countDelivery(
  counts: WebmentionPublishResult,
  status: WebmentionDeliveryStatus
) {
  counts[status === 'no_endpoint' ? 'unsupported' : status]++;
}
