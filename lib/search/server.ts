import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generateSearchIndex } from './index';
import { rankItems, tokenize } from './rank';
import type {
  SearchOptions,
  SearchResponse,
  SearchResult,
  SearchableItem,
} from './types';

const INDEX_PATH = join(process.cwd(), 'public', 'search-index.json');

/**
 * The JSON index is the default backend. Postgres full-text search only runs
 * when SEARCH_BACKEND=postgres is set and a database URL is present, so a
 * deploy with no database still answers /search from its own domain.
 */
export function usePostgresSearch(): boolean {
  return (
    process.env.SEARCH_BACKEND === 'postgres' &&
    Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL)
  );
}

let indexPromise: Promise<SearchableItem[]> | null = null;

/**
 * Load the search index. The prebuild script writes public/search-index.json;
 * when that file is missing (dev server, fresh checkout) the index is built
 * from the content directory on first use and cached for the process.
 */
export async function loadSearchIndex(): Promise<SearchableItem[]> {
  if (!indexPromise) {
    indexPromise = readFile(INDEX_PATH, 'utf8')
      .then((raw) => JSON.parse(raw) as SearchableItem[])
      .catch(() => generateSearchIndex())
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

export async function searchContent(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const { type = 'all', limit = 20, offset = 0 } = options;
  const trimmed = query.trim();
  const backend = usePostgresSearch() ? 'postgres' : 'index';

  // Project pages are parked in app/_(pages), so a project result would
  // link to a 404. Projects return nothing and "all" means writings until
  // those pages come back.
  if (type === 'project') {
    return { results: [], total: 0, query: trimmed, backend };
  }
  const kind = 'writing' as const;

  if (!trimmed || tokenize(trimmed).length === 0) {
    return { results: [], total: 0, query: trimmed, backend };
  }

  if (backend === 'postgres') {
    const { searchPostgres } = await import('./postgres');
    return searchPostgres(trimmed, { type: kind, limit, offset });
  }

  const items = await loadSearchIndex();
  const matches = rankItems(
    items.filter((item) => item.type === kind),
    trimmed
  );
  const results: SearchResult[] = matches.slice(offset, offset + limit);
  return { results, total: matches.length, query: trimmed, backend };
}

/** Site-relative URL for a search result. */
export function searchResultPath(result: SearchResult): string {
  return result.path;
}
