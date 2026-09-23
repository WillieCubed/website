import { NextRequest, NextResponse, after } from 'next/server';

import { SITE_URL, WEBMENTION_ENDPOINT } from '@/lib/indieweb/constants';
import { sameOrigin } from '@/lib/indieweb/utils';
import {
  WEBMENTION_RATE_WINDOW_MS,
  isWithinWebmentionRateLimit,
  webmentionRateLimitKey,
} from '@/lib/indieweb/webmention-rate-limit';
import {
  storeWebmention,
  webmentionRateLimitStore,
} from '@/lib/indieweb/webmention-storage';
import { verifyWebmention } from '@/lib/indieweb/webmention-verifier';

/**
 * POST /api/webmention
 * Receive a webmention notification.
 */
export async function POST(request: NextRequest) {
  // Rate limiting, counted in Postgres so it holds across instances
  const allowed = await isWithinWebmentionRateLimit(
    webmentionRateLimitStore,
    webmentionRateLimitKey(request.headers)
  );

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    // Parse form data (standard webmention format)
    const contentType = request.headers.get('content-type') || '';

    let source: string | null = null;
    let target: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      source = formData.get('source') as string | null;
      target = formData.get('target') as string | null;
    } else if (contentType.includes('application/json')) {
      const json = await request.json();
      source = json.source;
      target = json.target;
    } else {
      return NextResponse.json(
        {
          error:
            'Unsupported content type. Use application/x-www-form-urlencoded or application/json.',
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!source || !target) {
      return NextResponse.json(
        { error: 'Both source and target URLs are required.' },
        { status: 400 }
      );
    }

    // Validate URLs
    let sourceUrl: URL;
    let targetUrl: URL;

    try {
      sourceUrl = new URL(source);
      targetUrl = new URL(target);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format for source or target.' },
        { status: 400 }
      );
    }

    // Only accept HTTPS
    if (sourceUrl.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Source URL must use HTTPS.' },
        { status: 400 }
      );
    }

    // Target must be on our site
    if (!sameOrigin(target, SITE_URL)) {
      return NextResponse.json(
        { error: 'Target URL must be on this site.' },
        { status: 400 }
      );
    }

    // Target must be a writings page
    if (!target.includes('/writings/')) {
      return NextResponse.json(
        { error: 'Target must be a blog post.' },
        { status: 400 }
      );
    }

    // Store the webmention (unverified)
    const id = await storeWebmention(source, target);

    // Verify after the response is sent. `after` keeps the invocation alive
    // until the callback settles, where a bare promise could be cut off.
    after(async () => {
      try {
        await verifyWebmention(id, source, target);
      } catch (error) {
        console.error('Webmention verification failed:', error);
      }
      try {
        await webmentionRateLimitStore.prune(WEBMENTION_RATE_WINDOW_MS);
      } catch (error) {
        console.error('Pruning webmention rate limits failed:', error);
      }
    });

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
 * GET /api/webmention
 * Return endpoint information for discovery.
 */
export async function GET() {
  return NextResponse.json({
    webmention: `${SITE_URL}${WEBMENTION_ENDPOINT}`,
    documentation: 'https://www.w3.org/TR/webmention/',
  });
}
