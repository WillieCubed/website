import { timingSafeEqual } from 'node:crypto';

import { syncAtproto } from '@/lib/atproto/sync';
import { sendChangedWebmentions } from '@/lib/indieweb/webmention-publisher';
import {
  pingWebSubHub,
  publishedTopicPaths,
} from '@/lib/indieweb/websub-publisher';
import { absoluteUrl } from '@/lib/site';

// 60s is the Hobby cap while Fluid compute is off; a larger value fails the deploy.
export const maxDuration = 60;

function equalSecret(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.INDIEWEB_NOTIFY_SECRET;
  if (!secret) return Response.json({ error: 'unavailable' }, { status: 503 });
  if (
    !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
  ) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const revision = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!revision || body.sha !== revision) {
    return Response.json({ error: 'revision_mismatch' }, { status: 409 });
  }

  try {
    const topics = await publishedTopicPaths();
    const websub = await pingWebSubHub(topics.map((path) => absoluteUrl(path)));
    const webmentions = await sendChangedWebmentions();
    // Last, and on its own, so a PDS outage never holds back WebSub or
    // webmentions; a failure still fails the workflow run.
    const atproto = await syncAtproto().catch((error: unknown) => {
      console.error('AT Protocol sync failed:', error);
      return { status: 'failed' as const };
    });
    return Response.json(
      { websub, webmentions, atproto },
      {
        status:
          websub.ok && webmentions.failed === 0 && atproto.status !== 'failed'
            ? 200
            : 502,
      }
    );
  } catch (error) {
    console.error('IndieWeb publish notification failed:', error);
    return Response.json({ error: 'notification_failed' }, { status: 502 });
  }
}
