import { after } from 'next/server';

import { jsonError } from '@/lib/indieweb/responses';
import {
  defaultSalmentionDeps,
  sendSalmention,
} from '@/lib/indieweb/salmention';
import {
  handleListPendingWebmentions,
  handleModerateWebmention,
} from '@/lib/indieweb/webmention/moderation';
import { invalidatePublicWebmentions } from '@/lib/indieweb/webmention/public-reads';
import {
  getWebmentionTargetRequest,
  webmentionModerationStore,
} from '@/lib/indieweb/webmention/storage';
import type { WebmentionModerationRouteOptions } from '@/lib/indieweb/webmention/types';

/**
 * List verified webmentions awaiting moderation. Require the
 * WEBMENTION_MODERATION_SECRET bearer token.
 */
export async function GET(request: Request) {
  try {
    return await handleListPendingWebmentions(request, routeOptions());
  } catch (error) {
    console.error('Listing pending webmentions failed:', error);
    return jsonError('server_error', 500);
  }
}

/**
 * Approve or reject a webmention using a JSON action and id. Require the
 * WEBMENTION_MODERATION_SECRET bearer token. Refresh cached mentions after a
 * successful decision; approving a reply also schedules upstream
 * notifications.
 */
export async function POST(request: Request) {
  try {
    const response = await handleModerateWebmention(request, {
      ...routeOptions(),
      // `after` runs once the response is sent, which is after the
      // revalidation below, so the post can already show the reply.
      onApproved: (id) => after(() => notifyUpstream(id)),
    });
    if (response.ok) {
      try {
        const { id } = await response.clone().json();
        const target = await getWebmentionTargetRequest(id);
        if (target) await invalidatePublicWebmentions(target.targetUrl);
      } catch (error) {
        console.error('Invalidating public Webmentions failed:', error);
      }
    }
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
