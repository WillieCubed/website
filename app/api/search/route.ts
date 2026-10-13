import { NextRequest, NextResponse } from 'next/server';

import { searchContent } from '@/lib/search/server';
import type { SearchContentType } from '@/lib/search/types';
import { studioRoute } from '@/lib/studio/auth';
import { isPrivatePreview } from '@/lib/studio/config';

const CONTENT_TYPES: SearchContentType[] = [
  'writing',
  'initiative',
  'page',
  'project',
  'all',
];

/**
 * GET /api/search
 *
 * JSON search over the site's own content from the build-time index.
 *
 * Query parameters:
 * - q: Search query (required)
 * - type: 'writing' | 'initiative' | 'page' | 'project' | 'all' (default: 'all')
 * - limit: Maximum results (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  if (isPrivatePreview()) {
    return studioRoute(request, async () => {
      const { searchPrivate } = await import('@/lib/studio/search');
      const searchParams = request.nextUrl.searchParams;
      const query = searchParams.get('q');
      if (!query)
        return NextResponse.json(
          { error: 'Missing required parameter: q' },
          { status: 400 }
        );
      if (searchParams.get('type') === 'project')
        return NextResponse.json({
          results: [],
          total: 0,
          query,
          backend: 'private',
        });
      const type =
        CONTENT_TYPES.find((value) => value === searchParams.get('type')) ??
        'all';
      const result = await searchPrivate(query, {
        type,
        limit: clampInteger(searchParams.get('limit'), 20, 1, 100),
        offset: clampInteger(searchParams.get('offset'), 0, 0),
      });
      return NextResponse.json(result);
    });
  }
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const typeParam = searchParams.get('type');

  if (!query) {
    return NextResponse.json(
      { error: 'Missing required parameter: q' },
      { status: 400 }
    );
  }

  const type = CONTENT_TYPES.find((value) => value === typeParam) ?? 'all';
  const limit = clampInteger(searchParams.get('limit'), 20, 1, 100);
  const offset = clampInteger(searchParams.get('offset'), 0, 0);

  try {
    const result = await searchContent(query, { type, limit, offset });
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

function clampInteger(
  raw: string | null,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
