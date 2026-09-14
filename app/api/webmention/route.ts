import { NextRequest, NextResponse } from 'next/server';

import { SITE_URL, WEBMENTION_ENDPOINT } from '@/lib/indieweb/constants';
import { sameOrigin } from '@/lib/indieweb/utils';
import { storeWebmention } from '@/lib/indieweb/webmention-storage';
import { verifyWebmention } from '@/lib/indieweb/webmention-verifier';

// Rate limiting: simple in-memory store (consider using Vercel KV for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * POST /api/webmention
 * Receive a webmention notification.
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
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

    // Verify asynchronously (don't block the response)
    // In production, you might want to use a queue (Vercel Cron, QStash, etc.)
    verifyWebmention(id, source, target).catch((error) => {
      console.error('Webmention verification failed:', error);
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
