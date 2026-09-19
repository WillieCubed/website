/**
 * Stands in for a date on items that have none. It satisfies the
 * `published_at NOT NULL` column and sorts undated items last.
 */
export const UNDATED = '1970-01-01T00:00:00.000Z';

export type SearchableItem = {
  /**
   * Unique across every type: the Postgres `slug` column is UNIQUE. Writings
   * keep their bare slug; other types are prefixed (`initiatives/twd`,
   * `pages/home`).
   */
  slug: string;
  /** Site-relative URL the result opens. */
  path: string;
  title: string;
  description: string;
  /** Plain text content, stripped of MDX syntax */
  content: string;
  tags: string[];
  /** ISO date string, or UNDATED */
  published: string;
  type: 'writing' | 'initiative' | 'page' | 'project';
};

export type SearchResult = SearchableItem & {
  /** Relevance score. Higher is better. */
  score?: number;
  /** Short excerpt around the first matching term, when one exists. */
  snippet?: string;
};

export type SearchContentType = SearchableItem['type'] | 'all';

export interface SearchOptions {
  /** Filter by content type */
  type?: SearchContentType;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  /** Which backend answered the query. */
  backend: 'index' | 'postgres';
}
