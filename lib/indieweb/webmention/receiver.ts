import {
  defaultSalmentionDeps,
  sendSalmention,
} from '@/lib/indieweb/salmention';
import { applyVouch, readVouchParameter } from '@/lib/indieweb/vouch';
import { invalidatePublicWebmentions } from '@/lib/indieweb/webmention/public-reads';
import { WEBMENTION_RATE_WINDOW_MS } from '@/lib/indieweb/webmention/rate-limit';
import {
  getWebmentionBySourceTarget,
  webmentionRateLimitStore,
  webmentionVouchStore,
} from '@/lib/indieweb/webmention/storage';
import {
  canonicalWebmentionTarget,
  sitePath,
} from '@/lib/indieweb/webmention/targets';
import type { WebmentionVerificationResult } from '@/lib/indieweb/webmention/types';
import { verifyWebmention } from '@/lib/indieweb/webmention/verifier';

export interface WebmentionSubmission {
  source: string;
  target: string;
  canonicalTarget: string;
  vouch: string | null;
}
async function readPayload(request: Request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    return {
      source: form.get('source'),
      target: form.get('target'),
      vouchParameter: form.get('vouch'),
    };
  }
  if (contentType.includes('application/json')) {
    const json = await request.json();
    return {
      source: json.source as unknown,
      target: json.target as unknown,
      vouchParameter: json.vouch as unknown,
    };
  }
  return Response.json(
    {
      error:
        'Unsupported content type. Use application/x-www-form-urlencoded or application/json.',
    },
    { status: 400 }
  );
}

export async function readWebmentionSubmission(
  request: Request,
  existingPages: () => Promise<string[]>
): Promise<WebmentionSubmission | Response> {
  const payload = await readPayload(request);
  if (payload instanceof Response) return payload;
  const { source, target, vouchParameter } = payload;
  // Validate required fields
  if (
    typeof source !== 'string' ||
    typeof target !== 'string' ||
    !source ||
    !target
  ) {
    return Response.json(
      { error: 'Both source and target URLs are required.' },
      { status: 400 }
    );
  }

  const urls = validateSubmissionUrls(source, target, vouchParameter);
  if (urls instanceof Response) return urls;
  // Target must be on our site, under any host that redirects here
  if (sitePath(target) === null) {
    return Response.json(
      { error: 'Target URL must be on this site.' },
      { status: 400 }
    );
  }

  // Target must be a page that exists, stored under its canonical address
  const canonicalTarget = canonicalWebmentionTarget(
    target,
    await existingPages()
  );
  if (!canonicalTarget) {
    return Response.json(
      { error: 'Target must be a page on this site.' },
      { status: 400 }
    );
  }

  return { source, target, canonicalTarget, vouch: urls.vouch };
}
export async function completeWebmentionVerification(
  id: string,
  { source, target, canonicalTarget, vouch }: WebmentionSubmission
): Promise<void> {
  try {
    const result = await verifyWebmention(id, source, canonicalTarget, {
      verificationTarget: target,
    });
    let vouched = false;
    if (result.success && !result.isDeleted && vouch) {
      const outcome = await applyVouch(
        { id, sourceUrl: source, vouchUrl: vouch },
        webmentionVouchStore
      );
      console.info(`Vouch for ${source}: ${outcome}`);
      vouched = outcome === 'approved';
    }
    await refreshPublicSnapshot(result, source, canonicalTarget);
    // A vouch approves without a moderator, so it notifies upstream here.
    if (vouched) {
      const salmention = await sendSalmention(id, defaultSalmentionDeps());
      console.info(
        `Salmention after vouch for ${source}: ${salmention.outcome}`
      );
    }
  } catch (error) {
    console.error('Webmention verification failed:', error);
  }
  try {
    await webmentionRateLimitStore.prune(WEBMENTION_RATE_WINDOW_MS);
  } catch (error) {
    console.error('Pruning webmention rate limits failed:', error);
  }
}
async function refreshPublicSnapshot(
  result: WebmentionVerificationResult,
  source: string,
  canonicalTarget: string
): Promise<void> {
  // Finish any vouch approval before clearing the public snapshot.
  // Unapproved submissions do not need to wake Neon on the next read.
  if (result.success) {
    const current = result.isDeleted
      ? null
      : await getWebmentionBySourceTarget(source, canonicalTarget);
    if (result.isDeleted || current?.isApproved) {
      try {
        await invalidatePublicWebmentions(canonicalTarget);
      } catch (error) {
        console.error('Invalidating public Webmentions failed:', error);
      }
    }
  }
}

function validateSubmissionUrls(
  source: string,
  target: string,
  vouchParameter: unknown
): { vouch: string | null } | Response {
  // Validate URLs
  let sourceUrl: URL;
  let targetUrl: URL;

  try {
    sourceUrl = new URL(source);
    targetUrl = new URL(target);
  } catch {
    return Response.json(
      { error: 'Invalid URL format for source or target.' },
      { status: 400 }
    );
  }

  const vouch = readVouchParameter(vouchParameter);
  if ('error' in vouch) {
    return Response.json({ error: vouch.error }, { status: 400 });
  }

  if (
    !['http:', 'https:'].includes(sourceUrl.protocol) ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.href === targetUrl.href
  ) {
    return Response.json(
      { error: 'Source must be a distinct public HTTP or HTTPS page.' },
      { status: 400 }
    );
  }

  return { vouch: vouch.vouch };
}
