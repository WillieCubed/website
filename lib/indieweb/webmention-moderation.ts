import { createHash, timingSafeEqual } from 'node:crypto';

import {
  jsonError,
  jsonResponse,
  noStoreJsonHeaders,
} from '@/lib/indieweb/responses';
import type {
  PendingWebmentionSummary,
  Webmention,
  WebmentionModerationAction,
  WebmentionModerationCommand,
  WebmentionModerationRequest,
  WebmentionModerationRouteOptions,
  WebmentionModerationStore,
} from '@/lib/indieweb/types';

/**
 * Moderation for incoming webmentions. Received mentions are stored
 * unapproved, and nothing displays until one is approved here, either through
 * `/api/webmention/moderate` or `pnpm webmentions:moderate`. Both act through
 * a `WebmentionModerationStore` so the logic runs without a database in tests.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MODERATION_PAST_TENSE: Record<WebmentionModerationAction, string> =
  {
    approve: 'approved',
    reject: 'rejected',
  };

export function isWebmentionId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isModerationAction(
  value: unknown
): value is WebmentionModerationAction {
  return value === 'approve' || value === 'reject';
}

/**
 * Compare an `Authorization` header against the moderation secret. The
 * digests keep the comparison constant-time whatever the header's length.
 */
export function isAuthorizedModerator(
  authorization: string | null,
  secret: string
): boolean {
  if (!authorization) return false;
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const actual = createHash('sha256').update(authorization).digest();
  return timingSafeEqual(expected, actual);
}

export function parseModerationRequest(
  body: unknown
): WebmentionModerationRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { action, id } = body as Record<string, unknown>;
  if (!isModerationAction(action) || !isWebmentionId(id)) return null;
  return { action, id };
}

export function summarizePendingWebmention(
  webmention: Webmention
): PendingWebmentionSummary {
  return {
    id: webmention.id,
    source: webmention.sourceUrl,
    target: webmention.targetUrl,
    type: webmention.type,
    author: webmention.author.name ?? webmention.author.url,
    content: webmention.content,
    received: webmention.receivedAt.toISOString(),
    verified: webmention.isVerified,
  };
}

/**
 * Apply one moderation action. Resolves to false when the store had nothing
 * it could change: an unknown id, an unverified mention being approved, or a
 * mention that was already rejected.
 */
export function moderateWebmention(
  store: WebmentionModerationStore,
  { action, id }: WebmentionModerationRequest
): Promise<boolean> {
  return action === 'approve' ? store.approve(id) : store.reject(id);
}

/**
 * Check the bearer secret, returning the response to send when it fails.
 */
function refuse(request: Request, secret: string | undefined): Response | null {
  if (!secret) {
    return jsonError(
      'not_configured',
      503,
      'Set WEBMENTION_MODERATION_SECRET to enable moderation.'
    );
  }
  if (!isAuthorizedModerator(request.headers.get('authorization'), secret)) {
    return jsonError('unauthorized', 401);
  }
  return null;
}

/**
 * GET: list webmentions awaiting moderation.
 */
export async function handleListPendingWebmentions(
  request: Request,
  { store, secret }: WebmentionModerationRouteOptions
): Promise<Response> {
  const refusal = refuse(request, secret);
  if (refusal) return refusal;

  const pending = (await store.listPending()).map(summarizePendingWebmention);
  return jsonResponse(
    { count: pending.length, pending },
    { headers: noStoreJsonHeaders() }
  );
}

/**
 * POST `{ "action": "approve" | "reject", "id": "<uuid>" }`.
 */
export async function handleModerateWebmention(
  request: Request,
  { store, secret }: WebmentionModerationRouteOptions
): Promise<Response> {
  const refusal = refuse(request, secret);
  if (refusal) return refusal;

  const moderation = parseModerationRequest(
    await request.json().catch(() => null)
  );
  if (!moderation) {
    return jsonError(
      'invalid_request',
      400,
      'Send JSON with "action" ("approve" or "reject") and a webmention "id".'
    );
  }

  if (!(await moderateWebmention(store, moderation))) {
    return jsonError(
      'not_found',
      404,
      moderation.action === 'approve'
        ? 'No verified, unrejected webmention has that id.'
        : 'No unrejected webmention has that id.'
    );
  }

  return jsonResponse(
    { id: moderation.id, status: MODERATION_PAST_TENSE[moderation.action] },
    { headers: noStoreJsonHeaders() }
  );
}

/**
 * Parse `pnpm webmentions:moderate` arguments: `list`, or `approve` or
 * `reject` followed by one or more webmention ids.
 */
export function parseModerationCommand(
  args: string[]
): WebmentionModerationCommand | { error: string } {
  const [command = 'list', ...ids] = args;

  if (command === 'list') {
    return ids.length === 0
      ? { command }
      : { error: '`list` takes no arguments.' };
  }

  if (!isModerationAction(command)) {
    return { error: `Unknown command "${command}".` };
  }
  if (ids.length === 0) {
    return { error: `\`${command}\` needs at least one webmention id.` };
  }
  const invalid = ids.filter((id) => !isWebmentionId(id));
  if (invalid.length > 0) {
    return { error: `Not a webmention id: ${invalid.join(', ')}` };
  }
  return { command, ids };
}

/**
 * Render one pending webmention as the CLI prints it.
 */
export function formatPendingWebmention(
  summary: PendingWebmentionSummary
): string {
  const lines = [
    `${summary.id}  ${summary.type}${summary.verified ? '' : ' (unverified)'}`,
    `  from    ${summary.source}`,
    `  to      ${summary.target}`,
  ];
  if (summary.author) lines.push(`  author  ${summary.author}`);
  if (summary.content) {
    const excerpt = summary.content.replace(/\s+/g, ' ').trim();
    lines.push(
      `  says    ${excerpt.length > 120 ? `${excerpt.slice(0, 119)}…` : excerpt}`
    );
  }
  lines.push(`  at      ${summary.received}`);
  return lines.join('\n');
}
