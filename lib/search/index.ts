import { collectSearchDocuments } from './collect';
import type { SearchableItem } from './types';

/**
 * Generates the search index for the whole site. The prebuild script and the
 * Postgres reindex route call this; the collector does the work.
 */
export async function generateSearchIndex(): Promise<SearchableItem[]> {
  return collectSearchDocuments();
}

export type { SearchableItem, SearchResult } from './types';
