import { getCloudflareContext } from '@opennextjs/cloudflare';
import { revalidatePath } from 'next/cache';

import { flattenWebmentionActivities } from '@/lib/indieweb/activity-feed';
import { SITE_URL } from '@/lib/indieweb/constants';
import {
  invalidatePublicWebmentionSnapshot,
  readPublicWebmentionSnapshot,
} from '@/lib/indieweb/public-webmention-snapshot';
import type {
  PublicWebmentionResponse,
  Webmention,
  WebmentionActivity,
  WebmentionGroup,
} from '@/lib/indieweb/types';
import {
  buildPublicWebmentionResponse,
  groupWebmentions,
  listApprovedWebmentions,
} from '@/lib/indieweb/webmention-storage';

function bucket() {
  try {
    return getCloudflareContext().env.NEXT_INC_CACHE_R2_BUCKET;
  } catch {
    return undefined;
  }
}

async function snapshot(): Promise<Webmention[]> {
  return readPublicWebmentionSnapshot(bucket(), listApprovedWebmentions);
}

export async function publicWebmentionsForTarget(
  targetUrl: string
): Promise<WebmentionGroup> {
  return groupWebmentions(
    (await snapshot()).filter((mention) => mention.targetUrl === targetUrl)
  );
}

export function publicWebmentionsForPost(slug: string) {
  return publicWebmentionsForTarget(`${SITE_URL}/writings/${slug}`);
}

export async function publicWebmentionActivitiesForPost(
  slug: string
): Promise<WebmentionActivity[]> {
  return flattenWebmentionActivities(await publicWebmentionsForPost(slug));
}

export async function allPublicWebmentionActivities(
  limit = 100
): Promise<WebmentionActivity[]> {
  return flattenWebmentionActivities(groupWebmentions(await snapshot())).slice(
    0,
    limit
  );
}

export async function publicWebmentionResponseForTarget(
  targetUrl: string
): Promise<PublicWebmentionResponse> {
  return buildPublicWebmentionResponse(
    targetUrl,
    (await snapshot()).filter((mention) => mention.targetUrl === targetUrl)
  );
}

/** Clear the shared snapshot and the affected page after a verified write. */
export async function invalidatePublicWebmentions(
  targetUrl: string
): Promise<void> {
  await invalidatePublicWebmentionSnapshot(bucket());
  revalidatePath(new URL(targetUrl).pathname);
}
