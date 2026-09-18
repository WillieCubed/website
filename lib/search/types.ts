export type SearchableItem = {
  slug: string;
  title: string;
  description: string;
  /** Plain text content, stripped of MDX syntax */
  content: string;
  tags: string[];
  /** ISO date string */
  published: string;
  type: 'writing' | 'project';
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
