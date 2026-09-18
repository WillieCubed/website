import type { SearchResult, SearchableItem } from './types';

/**
 * In-memory ranking over the JSON search index.
 *
 * This is deliberately a plain token matcher rather than a fuzzy library so
 * the search page works with no database and no client-side JavaScript.
 * Every query term must appear in at least one field for an item to match.
 */
export function rankItems(
  items: SearchableItem[],
  query: string
): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const scored: SearchResult[] = [];
  for (const item of items) {
    const fields = {
      title: item.title.toLowerCase(),
      description: item.description.toLowerCase(),
      tags: item.tags.join(' ').toLowerCase(),
      content: item.content.toLowerCase(),
    };

    let score = 0;
    let matchedAllTerms = true;
    for (const term of terms) {
      const termScore =
        (fields.title.includes(term) ? 8 : 0) +
        (fields.tags.includes(term) ? 5 : 0) +
        (fields.description.includes(term) ? 3 : 0) +
        (fields.content.includes(term) ? 1 : 0);
      if (termScore === 0) {
        matchedAllTerms = false;
        break;
      }
      score += termScore;
    }
    if (!matchedAllTerms) continue;

    scored.push({ ...item, score, snippet: snippetFor(item.content, terms) });
  }

  return scored.sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      new Date(b.published).getTime() - new Date(a.published).getTime()
  );
}

export function tokenize(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.replace(/[^\p{L}\p{N}-]/gu, ''))
        .filter((term) => term.length >= 2)
    ),
  ];
}

function snippetFor(content: string, terms: string[]): string | undefined {
  const lower = content.toLowerCase();
  const hit = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (hit === undefined) return undefined;

  const start = Math.max(0, hit - 80);
  const end = Math.min(content.length, hit + 120);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${content.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}
