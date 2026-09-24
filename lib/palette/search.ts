/**
 * Site search for the palette, through Pagefind's JS API over the index the
 * build writes to public/pagefind (lib/search/pagefind.ts). Nothing loads
 * until the palette first opens; the index and its WASM follow on the first
 * query.
 */

/** The parts of Pagefind's browser API the palette uses. */
interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string | undefined>;
}

interface PagefindApi {
  options(options: Record<string, unknown>): Promise<void>;
  init(): Promise<void>;
  debouncedSearch(
    term: string,
    options?: Record<string, unknown>,
    debounceMs?: number
  ): Promise<{
    results: Array<{ id: string; data: () => Promise<PagefindResultData> }>;
  } | null>;
}

const PAGEFIND_URL = '/pagefind/pagefind.js';

/** Results per query; the palette is for jumping, not browsing. */
const LIMIT = 8;

/** How long typing has to pause before a query runs. */
const DEBOUNCE_MS = 120;

export type SearchKind = 'writing' | 'initiative' | 'page';

export const SEARCH_GROUPS: Array<{ kind: SearchKind; label: string }> = [
  { kind: 'writing', label: 'Writings' },
  { kind: 'initiative', label: 'Initiatives' },
  { kind: 'page', label: 'Pages' },
];

/** One piece of an excerpt: plain text, or a run Pagefind marked as a hit. */
export interface ExcerptPart {
  text: string;
  mark: boolean;
}

export interface SearchRow {
  id: string;
  title: string;
  href: string;
  kind: SearchKind;
  excerpt: ExcerptPart[];
}

let loading: Promise<PagefindApi> | null = null;

/**
 * Loads Pagefind once. The import is left to the browser, not the bundler,
 * because the file only exists after the index build. A failed load is
 * forgotten so the next query can try again.
 */
export function loadPagefind(): Promise<PagefindApi> {
  loading ??= (async () => {
    const pagefind = (await import(
      /* webpackIgnore: true */ PAGEFIND_URL
    )) as PagefindApi;
    await pagefind.options({ excerptLength: 16 });
    await pagefind.init();
    return pagefind;
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

/** Drops any tag left in the escaped text, then decodes the entities. */
function decode(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => {
      return ENTITIES[entity] ?? entity;
    });
}

/**
 * Splits Pagefind's excerpt, which is escaped text with `<mark>` around each
 * hit, into parts the palette renders as React text. Nothing from the index
 * is ever set as HTML, so a stray tag in content stays text.
 */
export function excerptParts(html: string): ExcerptPart[] {
  const parts: ExcerptPart[] = [];
  const pattern = /<mark>([\s\S]*?)<\/mark>/g;
  let last = 0;
  for (const match of html.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ text: decode(html.slice(last, index)), mark: false });
    }
    parts.push({ text: decode(match[1]), mark: true });
    last = index + match[0].length;
  }
  if (last < html.length) {
    parts.push({ text: decode(html.slice(last)), mark: false });
  }
  return parts.filter((part) => part.text !== '');
}

function kindOf(type: string | undefined): SearchKind {
  return type === 'writing' || type === 'initiative' ? type : 'page';
}

/** Maps one Pagefind result to a palette row. */
export function toSearchRow(data: PagefindResultData): SearchRow {
  return {
    id: `search:${data.url}`,
    title: data.meta.title || data.url,
    href: data.url,
    kind: kindOf(data.meta.type),
    excerpt: excerptParts(data.excerpt),
  };
}

/**
 * Searches the index. Resolves null when a newer query superseded this one
 * while it waited out the debounce, so the caller keeps its current rows.
 */
export async function searchSite(query: string): Promise<SearchRow[] | null> {
  const pagefind = await loadPagefind();
  const search = await pagefind.debouncedSearch(query, {}, DEBOUNCE_MS);
  if (!search) return null;
  const data = await Promise.all(
    search.results.slice(0, LIMIT).map((result) => result.data())
  );
  return data.map(toSearchRow);
}
