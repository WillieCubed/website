import { revalidateTag } from 'next/cache';
import { after } from 'next/server';

import { jsonError } from '@/lib/indieweb/responses';
import {
  defaultSalmentionDeps,
  sendSalmention,
} from '@/lib/indieweb/salmention';
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
 * Approving a reply resends its post's webmentions upstream (Salmention).
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
    const response = await handleModerateWebmention(request, {
      ...routeOptions(),
      // `after` runs once the response is sent, which is after the
      // revalidation below, so the post can already show the reply.
      onApproved: (id) => after(() => notifyUpstream(id)),
    });
    if (response.ok) revalidateTag('webmentions', { expire: 0 });
    return response;
  } catch (error) {
    console.error('Webmention moderation failed:', error);
    return jsonError('server_error', 500);
  }
}

async function notifyUpstream(id: string): Promise<void> {
  try {
    const { outcome } = await sendSalmention(id, defaultSalmentionDeps());
    console.info(`Salmention after approving ${id}: ${outcome}`);
  } catch (error) {
    console.error('Salmention failed:', error);
  }
}

function routeOptions(): WebmentionModerationRouteOptions {
  return {
    store: webmentionModerationStore,
    secret: process.env.WEBMENTION_MODERATION_SECRET,
  };
}
