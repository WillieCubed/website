import { NextRequest, NextResponse } from 'next/server';

import { searchContent } from '@/lib/search/server';
import type { SearchContentType } from '@/lib/search/types';

const CONTENT_TYPES: SearchContentType[] = [
  'writing',
  'initiative',
  'page',
  'project',
  'all',
];

/**
 * Search published site content and return JSON results for the required q
 * parameter. Filter by type when supplied; default to all content, limit 20,
 * and offset 0. Clamp limit to 1–100 and offset to zero or greater. Use the
 * build-time index unless Postgres search is enabled.
 */
export async function GET(request: NextRequest) {
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
