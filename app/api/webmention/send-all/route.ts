import { NextRequest, NextResponse } from 'next/server';

import { sendWebmentionsForPost } from '@/lib/indieweb/send-webmention';
import type {
  SendAllWebmentionsRequest,
  SendAllWebmentionsWritingResult,
} from '@/lib/indieweb/types';
import { getAllWritings, readWritingFile } from '@/lib/writings';

/**
 * POST /api/webmention/send-all
 *
 * Send webmentions for all published writings.
 * Designed to be called from a Vercel deploy hook.
 *
 * Requires WEBMENTION_SECRET for authentication.
 *
 * Optional body parameters:
 * - slugs: string[] - Only send for specific slugs (useful for incremental updates)
 * - dryRun: boolean - If true, only return what would be sent without actually sending
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

      // Get the raw content which contains the links
      const { source } = readWritingFile(writing.slug);
      const results = await sendWebmentionsForPost(
        writing.slug,
        source.toString()
      );

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
