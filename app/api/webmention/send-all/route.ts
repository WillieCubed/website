import { NextRequest, NextResponse } from 'next/server';

import { sendWebmentionsForPost } from '@/lib/indieweb/webmention/send';
import type {
  SendAllWebmentionsRequest,
  SendAllWebmentionsWritingResult,
} from '@/lib/indieweb/webmention/types';
import { getAllWritings, getPublishedWriting } from '@/lib/writings/index';

/**
 * Send outgoing webmentions for published writings and return per-writing
 * results and totals. Require the WEBMENTION_SECRET bearer token. An
 * optional slugs array limits the writings; dryRun reports which writings
 * would be processed without sending notifications.
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json().catch(() => ({}));
    const { slugs, dryRun } = body as SendAllWebmentionsRequest;

    // Get all writings
    const allWritings = await getAllWritings();

    // Filter to specific slugs if provided
    const writings = slugs
      ? allWritings.filter((w) => slugs.includes(w.slug))
      : allWritings;

    if (writings.length === 0) {
      return NextResponse.json({
        message: 'No writings found to process.',
        results: [],
      });
    }

    const allResults: SendAllWebmentionsWritingResult[] = [];

    for (const writing of writings) {
      // Skip drafts
      if (writing.draft) continue;

      if (dryRun) {
        // In dry run mode, just report what we would process
        allResults.push({
          slug: writing.slug,
          results: [{ targetUrl: '(dry run)', success: true }],
        });
        continue;
      }

      // The body without its frontmatter, where syndication and image URLs
      // would otherwise read as bare links.
      const { content } = await getPublishedWriting(writing.slug);
      const results = await sendWebmentionsForPost(writing, content);

      allResults.push({
        slug: writing.slug,
        results: results.map((r) => ({
          targetUrl: r.targetUrl,
          success: r.success,
          error: r.error,
        })),
      });

      // Small delay between posts to be polite
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const totalSent = allResults.reduce(
      (acc, r) => acc + r.results.filter((x) => x.success).length,
      0
    );
    const totalFailed = allResults.reduce(
      (acc, r) => acc + r.results.filter((x) => !x.success).length,
      0
    );

    return NextResponse.json({
      message: dryRun
        ? `Dry run: would process ${writings.length} writings.`
        : `Processed ${writings.length} writings. Sent ${totalSent} webmentions, ${totalFailed} failed.`,
      postsProcessed: writings.length,
      totalSent,
      totalFailed,
      results: allResults,
    });
  } catch (error) {
    console.error('Send all webmentions error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
