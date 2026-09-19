import { Fragment } from 'react';

import SiteLink from '@/components/link/SiteLink';

import { resultMeta } from '@/lib/search/meta';
import { searchContent, searchResultPath } from '@/lib/search/server';
import type { SearchResult } from '@/lib/search/types';

interface SiteSearchProps {
  /** The query from the URL, if any. */
  query?: string;
}

/**
 * Server-rendered site search.
 *
 * The form submits with GET so /search?q= is a shareable URL and the result
 * list is in the HTML itself, which is what IndieMark's "search results on
 * your own domain" criterion checks for.
 */
export default async function SiteSearch({ query = '' }: SiteSearchProps) {
  const trimmed = query.trim();
  const response = trimmed ? await searchContent(trimmed) : null;

  return (
    <div className="w-full space-y-lg">
      <form action="/search" method="get" role="search" className="relative">
        <label htmlFor="site-search-query" className="sr-only">
          Search
        </label>
        <input
          id="site-search-query"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search…"
          autoComplete="off"
          className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 pr-24 text-body-large placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary px-3 py-1.5 text-label-large text-white"
        >
          Search
        </button>
      </form>

      {response ? (
        <SearchResults response={response} />
      ) : (
        <p className="text-body-medium text-on-surface-variant">
          Type a word or two and press Search to look through everything on this
          site.
        </p>
      )}
    </div>
  );
}

function SearchResults({
  response,
}: {
  response: Awaited<ReturnType<typeof searchContent>>;
}) {
  const { results, total, query } = response;

  return (
    <section aria-live="polite">
      <p className="mb-4 text-label-large text-on-surface-variant">
        {total === 0
          ? `No results for “${query}”.`
          : `${total} result${total === 1 ? '' : 's'} for “${query}”`}
      </p>

      {results.length > 0 && (
        <ul className="space-y-4">
          {results.map((result) => (
            <li key={`${result.type}-${result.slug}`}>
              <SearchResultCard result={result} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const meta = resultMeta(result);

  return (
    <SiteLink
      preview={false}
      href={searchResultPath(result)}
      className="group block rounded-lg border border-outline-variant p-4 transition-all hover:border-primary hover:bg-primary/5"
    >
      <div className="flex flex-wrap items-center gap-2 text-label-medium text-on-surface-variant">
        {meta.map((part, index) => (
          <Fragment key={part.kind}>
            {index > 0 && <span aria-hidden="true">·</span>}
            {part.kind === 'type' ? (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 capitalize text-primary">
                {part.text}
              </span>
            ) : part.kind === 'date' ? (
              <time dateTime={part.dateTime}>{part.text}</time>
            ) : (
              <span>{part.text}</span>
            )}
          </Fragment>
        ))}
      </div>
      <h2 className="mt-1 text-title-large group-hover:text-primary">
        {result.title}
      </h2>
      <p className="mt-1 line-clamp-2 text-body-medium text-on-surface-variant">
        {result.description}
      </p>
      {result.snippet && (
        <p className="mt-2 line-clamp-2 text-body-small text-on-surface-variant/80">
          {result.snippet}
        </p>
      )}
    </SiteLink>
  );
}
