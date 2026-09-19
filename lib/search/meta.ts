import { formatDate } from '@/lib/site';

import type { SearchResult } from './types';

export interface ResultMetaPart {
  kind: 'type' | 'date' | 'tags';
  text: string;
  /** ISO timestamp for the `<time>` element. Only set on `date` parts. */
  dateTime?: string;
}

/**
 * The small-print parts under a search result, in display order: type, date,
 * then tags. A part that does not apply is left out, so the caller can put a
 * separator between the parts that exist and never render a dangling one.
 *
 * Only writings show a date. Initiative dates are whole days and pages have
 * none, and formatDate's zone shift would move a whole day back by one.
 */
export function resultMeta(result: SearchResult): ResultMetaPart[] {
  const parts: ResultMetaPart[] = [];

  if (result.type !== 'writing') {
    parts.push({ kind: 'type', text: result.type });
  }

  if (
    result.type === 'writing' &&
    !Number.isNaN(new Date(result.published).getTime())
  ) {
    parts.push({
      kind: 'date',
      text: formatDate(result.published, 'short'),
      dateTime: result.published,
    });
  }

  if (result.tags.length > 0) {
    parts.push({ kind: 'tags', text: result.tags.slice(0, 2).join(', ') });
  }

  return parts;
}
