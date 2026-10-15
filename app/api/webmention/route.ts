import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse, after } from 'next/server';

import { SITE_URL, WEBMENTION_ENDPOINT } from '@/lib/indieweb/constants';
import {
  isWithinEdgeWebmentionRateLimit,
  isWithinWebmentionRateLimit,
  webmentionRateLimitKey,
} from '@/lib/indieweb/webmention/rate-limit';
import {
  completeWebmentionVerification,
  readWebmentionSubmission,
} from '@/lib/indieweb/webmention/receiver';
import {
  storeWebmention,
  webmentionRateLimitStore,
} from '@/lib/indieweb/webmention/storage';
import { getInitiatives } from '@/lib/initiatives/index';
import { buildSitemap } from '@/lib/seo/sitemap';
import { getAllWritings } from '@/lib/writings/index';

/**
 * Every page a webmention may target: the sitemap's list, which covers the
 * homepage, the routed pages, initiatives and their parts, and published
 * writings. Cached for an hour like the loaders it reads from.
 */
async function existingPages(): Promise<string[]> {
  const [initiatives, writings] = await Promise.all([
    getInitiatives(),
    getAllWritings(),
  ]);
  return buildSitemap({ initiatives, writings }).map((entry) => entry.url);
}

function edgeRateLimiter() {
  try {
    return getCloudflareContext().env.WEBMENTION_EDGE_LIMIT;
  } catch {
    // The route also runs locally without Cloudflare bindings.
    return undefined;
  }
}

/**
 * Accept source and target URLs as form data or JSON and return 202 after
 * storing a pending webmention. Rate-limit senders, require an existing
 * local target and a distinct public HTTP source, and verify the source
 * after responding. An optional vouch can approve a verified mention.
 */
export async function POST(request: NextRequest) {
  try {
    const submission = await readWebmentionSubmission(request, existingPages);
    if (submission instanceof Response) return submission;
    const { source, target, canonicalTarget, vouch } = submission;

    // Rejected payloads must not wake Neon. Count only submissions that could
    // be stored. Cloudflare sheds bursts before Postgres; the database counter
    // remains authoritative across Worker locations and local development.
    const rateLimitKey = webmentionRateLimitKey(request.headers);
    const edgeAllowed = await isWithinEdgeWebmentionRateLimit(
      edgeRateLimiter(),
      rateLimitKey
    );
    if (!edgeAllowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    const allowed = await isWithinWebmentionRateLimit(
      webmentionRateLimitStore,
      rateLimitKey
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Store the webmention (unverified)
    const id = await storeWebmention(source, canonicalTarget);

    // Verify after the response is sent. `after` keeps the invocation alive
    // until the callback settles, where a bare promise could be cut off.
    after(() =>
      completeWebmentionVerification(id, {
        source,
        target,
        canonicalTarget,
        vouch,
      })
    );

    // Return 202 Accepted (async processing)
    return NextResponse.json(
      {
        status: 'accepted',
        message: 'Webmention received and queued for verification.',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Webmention error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

/**
 * Return the webmention receiving URL and a link to the protocol
 * specification for discovery clients.
 */
export async function GET() {
  return NextResponse.json({
    webmention: `${SITE_URL}${WEBMENTION_ENDPOINT}`,
    documentation: 'https://www.w3.org/TR/webmention/',
  });
}
