import { NextRequest, NextResponse } from 'next/server';

import { sendWebmentionsForPost } from '@/lib/indieweb/send-webmention';
import { getPublishedWriting } from '@/lib/writings';

/**
 * POST /api/webmention/send
 * Send webmentions for a specific blog post.
 *
 * Requires a secret key for authentication.
 * Body: { slug: string }
 */
export async function POST(request: NextRequest) {
  // Check for secret key (set via environment variable)
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.WEBMENTION_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Webmention sending not configured.' },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required.' }, { status: 400 });
    }

    let published;
    try {
      published = await getPublishedWriting(slug);
    } catch {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    const results = await sendWebmentionsForPost(
      published.writing,
      published.content
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Sent ${successful} webmentions, ${failed} failed.`,
      results,
    });
  } catch (error) {
    console.error('Send webmention error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
