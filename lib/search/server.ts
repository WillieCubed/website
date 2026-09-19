import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isHiatusMode } from '@/lib/site-mode';

import { generateSearchIndex } from './index';
import { rankItems, tokenize } from './rank';
import type {
  SearchContentType,
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
 * when that file is missing or was written before items carried a path (dev
 * server, fresh checkout, stale file) the index is built from the content
 * directory on first use and cached for the process.
 */
export async function loadSearchIndex(): Promise<SearchableItem[]> {
  if (!indexPromise) {
    indexPromise = readFile(INDEX_PATH, 'utf8')
      .then((raw) => {
        const items = JSON.parse(raw) as SearchableItem[];
        if (items.some((item) => typeof item.path !== 'string')) {
          throw new Error('stale search index');
        }
        return items;
      })
      .catch(() => generateSearchIndex())
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

/**
 * The items a query may match. Projects never match while their pages are
 * parked in app/_(pages), because a result would link to a 404.
 */
export function selectSearchable(
  items: SearchableItem[],
  type: SearchContentType
): SearchableItem[] {
  return items.filter(
    (item) => item.type !== 'project' && (type === 'all' || item.type === type)
  );
}

export async function searchContent(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const { limit = 20, offset = 0, type = 'all' } = options;
  const trimmed = query.trim();
  const backend = usePostgresSearch() ? 'postgres' : 'index';

  // Hiatus hides the content routes, so search would describe pages a visitor
  // cannot open. It returns nothing, as the MCP tools do.
  if (isHiatusMode() || !trimmed || tokenize(trimmed).length === 0) {
    return { results: [], total: 0, query: trimmed, backend };
  }

  if (backend === 'postgres') {
    const { searchPostgres } = await import('./postgres');
    return searchPostgres(trimmed, { type, limit, offset });
  }

  const items = await loadSearchIndex();
  const matches = rankItems(selectSearchable(items, type), trimmed);
  const results: SearchResult[] = matches.slice(offset, offset + limit);
  return { results, total: matches.length, query: trimmed, backend };
}

/** Site-relative URL for a search result. */
export function searchResultPath(result: SearchResult): string {
  return result.path;
}
