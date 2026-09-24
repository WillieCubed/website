import { revalidateTag } from 'next/cache';

import { jsonError } from '@/lib/indieweb/responses';
import type { WebmentionModerationRouteOptions } from '@/lib/indieweb/types';
import {
  handleListPendingWebmentions,
  handleModerateWebmention,
} from '@/lib/indieweb/webmention-moderation';
import { webmentionModerationStore } from '@/lib/indieweb/webmention-storage';

/**
 * GET /api/webmention/moderate
 * List webmentions awaiting moderation.
 *
 * POST /api/webmention/moderate
 * Approve or reject one: { "action": "approve" | "reject", "id": "<uuid>" }.
 *
 * Both require `Authorization: Bearer $WEBMENTION_MODERATION_SECRET`.
 */
export async function GET(request: Request) {
  try {
    return await handleListPendingWebmentions(request, routeOptions());
  } catch (error) {
    console.error('Listing pending webmentions failed:', error);
    return jsonError('server_error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const response = await handleModerateWebmention(request, routeOptions());
    if (response.ok) revalidateTag('webmentions', { expire: 0 });
    return response;
  } catch (error) {
    console.error('Webmention moderation failed:', error);
    return jsonError('server_error', 500);
  }
}

function routeOptions(): WebmentionModerationRouteOptions {
  return {
    store: webmentionModerationStore,
    secret: process.env.WEBMENTION_MODERATION_SECRET,
  };
}
