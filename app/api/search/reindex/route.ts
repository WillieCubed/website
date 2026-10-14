import { NextRequest, NextResponse } from 'next/server';

import { generateSearchIndex } from '@/lib/search';
import { usePostgresSearch } from '@/lib/search/server';

/**
 * Replace the Postgres search index with current site content and return the
 * indexed count and statistics. Return 503 unless Postgres search is
 * enabled. In production, require the bearer token when
 * SEARCH_REINDEX_SECRET is configured.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.SEARCH_REINDEX_SECRET;

  if (process.env.NODE_ENV === 'production' && expectedToken) {
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!usePostgresSearch()) {
    return NextResponse.json(
      {
        error:
          'Postgres search is not enabled. Set SEARCH_BACKEND=postgres and a database URL, or rerun the prebuild script for the JSON index.',
      },
      { status: 503 }
    );
  }

  try {
    const { getIndexStats, reindexAll } = await import('@/lib/search/postgres');
    const items = await generateSearchIndex();
    const indexed = await reindexAll(items);
    const stats = await getIndexStats();

    return NextResponse.json({
      success: true,
      message: `Reindexed ${indexed} items`,
      stats,
    });
  } catch (error) {
    console.error('Reindex error:', error);
    return NextResponse.json(
      { error: 'Reindex failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Return the active search backend and, for Postgres, index statistics
 * without rebuilding the index.
 */
export async function GET() {
  if (!usePostgresSearch()) {
    return NextResponse.json({ backend: 'index' });
  }

  try {
    const { getIndexStats } = await import('@/lib/search/postgres');
    const stats = await getIndexStats();
    return NextResponse.json({ backend: 'postgres', stats });
  } catch (error) {
    console.error('Index stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get index stats' },
      { status: 500 }
    );
  }
}
