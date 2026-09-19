import { sql } from '@vercel/postgres';

import type {
  SearchOptions,
  SearchResponse,
  SearchResult,
  SearchableItem,
} from './types';

/**
 * PostgreSQL full-text search over the `search_index` table.
 * Weighted ranking: title (A) > description/tags (B) > content (C).
 */
export async function searchPostgres(
  query: string,
  options: Required<SearchOptions>
): Promise<SearchResponse> {
  const { type, limit, offset } = options;

  const searchTerms = query
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .map((term) => `${term}:*`)
    .join(' & ');

  if (!searchTerms) {
    return { results: [], total: 0, query, backend: 'postgres' };
  }

  const typeFilter = type === 'all' ? null : type;

  const countResult = await sql`
    SELECT COUNT(*) as total
    FROM search_index
    WHERE search_vector @@ to_tsquery('english', ${searchTerms})
    AND (${typeFilter}::text IS NULL OR content_type = ${typeFilter})
  `;

  const total = parseInt(countResult.rows[0]?.total || '0', 10);
  if (total === 0) {
    return { results: [], total: 0, query, backend: 'postgres' };
  }

  const result = await sql`
    SELECT
      slug,
      content_type as type,
      title,
      description,
      tags,
      published_at,
      url,
      ts_rank(search_vector, to_tsquery('english', ${searchTerms})) as rank,
      ts_headline('english', content_text, to_tsquery('english', ${searchTerms}),
        'MaxWords=30, MinWords=15, StartSel=, StopSel='
      ) as snippet
    FROM search_index
    WHERE search_vector @@ to_tsquery('english', ${searchTerms})
    AND (${typeFilter}::text IS NULL OR content_type = ${typeFilter})
    ORDER BY rank DESC, published_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const results: SearchResult[] = result.rows.map((row) => ({
    slug: row.slug,
    path: row.url,
    title: row.title,
    description: row.description,
    content: row.snippet || '',
    snippet: row.snippet || undefined,
    tags: row.tags || [],
    published: row.published_at?.toISOString() || '',
    type: row.type as SearchableItem['type'],
    score: row.rank || 0,
  }));

  return { results, total, query, backend: 'postgres' };
}

export async function indexItem(item: SearchableItem): Promise<void> {
  const url = item.path;

  const tagsArray = `{${item.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`;

  await sql`
    INSERT INTO search_index (
      slug, content_type, title, description, content_text, tags, published_at, url
    ) VALUES (
      ${item.slug}, ${item.type}, ${item.title}, ${item.description},
      ${item.content}, ${tagsArray}::text[], ${item.published}::timestamptz, ${url}
    )
    ON CONFLICT (slug) DO UPDATE SET
      content_type = EXCLUDED.content_type,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      content_text = EXCLUDED.content_text,
      tags = EXCLUDED.tags,
      published_at = EXCLUDED.published_at,
      url = EXCLUDED.url,
      updated_at = NOW()
  `;
}

export async function reindexAll(items: SearchableItem[]): Promise<number> {
  await sql`TRUNCATE TABLE search_index`;

  let indexed = 0;
  for (const item of items) {
    try {
      await indexItem(item);
      indexed++;
    } catch (error) {
      console.error(`Failed to index ${item.slug}:`, error);
    }
  }

  return indexed;
}

export async function getIndexStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  lastUpdated: Date | null;
}> {
  const totalResult = await sql`SELECT COUNT(*) as total FROM search_index`;
  const byTypeResult = await sql`
    SELECT content_type, COUNT(*) as count
    FROM search_index
    GROUP BY content_type
  `;
  const lastUpdatedResult = await sql`
    SELECT MAX(COALESCE(updated_at, created_at)) as last_updated
    FROM search_index
  `;

  const byType: Record<string, number> = {};
  byTypeResult.rows.forEach((row) => {
    byType[row.content_type] = parseInt(row.count, 10);
  });

  return {
    total: parseInt(totalResult.rows[0]?.total || '0', 10),
    byType,
    lastUpdated: lastUpdatedResult.rows[0]?.last_updated || null,
  };
}
