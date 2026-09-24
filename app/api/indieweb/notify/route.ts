import { timingSafeEqual } from 'node:crypto';

import { sendChangedWebmentions } from '@/lib/indieweb/webmention-publisher';
import {
  SITE_FEED_PATHS,
  pingWebSubHub,
} from '@/lib/indieweb/websub-publisher';
import { absoluteUrl } from '@/lib/site';

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
    const websub = await pingWebSubHub(SITE_FEED_PATHS.map(absoluteUrl));
    const webmentions = await sendChangedWebmentions();
    return Response.json(
      { websub, webmentions },
      {
        status: websub.ok && webmentions.failed === 0 ? 200 : 502,
      }
    );
  } catch (error) {
    console.error('IndieWeb publish notification failed:', error);
    return Response.json({ error: 'notification_failed' }, { status: 502 });
  }
}
