import { join } from 'node:path';

import { readFileSync } from '../content/runtime-files';
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

let indexPromise: Promise<SearchableItem[]> | null = null;

/**
 * Load the search index. The prebuild script writes the serialized search index;
 * when that file is missing or was written before items carried a path (dev
 * server, fresh checkout, stale file) the index is built from the content
 * directory on first use and cached for the process.
 */
export async function loadSearchIndex(): Promise<SearchableItem[]> {
  if (!indexPromise) {
    indexPromise = Promise.resolve()
      .then(() => readFileSync(INDEX_PATH, 'utf8'))
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

/** The published items a query may match, optionally limited by type. */
export function selectSearchable(
  items: SearchableItem[],
  type: SearchContentType
): SearchableItem[] {
  return items.filter((item) => type === 'all' || item.type === type);
}

export async function searchContent(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const { limit = 20, offset = 0, type = 'all' } = options;
  const trimmed = query.trim();
  if (!trimmed || tokenize(trimmed).length === 0) {
    return { results: [], total: 0, query: trimmed, backend: 'index' };
  }

  const items = await loadSearchIndex();
  const matches = rankItems(selectSearchable(items, type), trimmed);
  const results: SearchResult[] = matches.slice(offset, offset + limit);
  return { results, total: matches.length, query: trimmed, backend: 'index' };
}

/** Site-relative URL for a search result. */
export function searchResultPath(result: SearchResult): string {
  return result.path;
}
