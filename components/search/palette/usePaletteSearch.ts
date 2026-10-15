'use client';
import { useEffect, useState } from 'react';

import {
  type SearchRow,
  loadPagefind,
  searchSite,
} from '@/lib/search/palette/search';

interface PaletteSearch {
  rows: SearchRow[];
  searching: boolean;
  error: string | null;
}
interface PaletteSearchState {
  query: string;
  rows: SearchRow[];
  status: 'pending' | 'ready' | 'failed';
}

export function usePaletteSearch(typed: string): PaletteSearch {
  const [search, setSearch] = useState<PaletteSearchState>({
    query: '',
    rows: [],
    status: 'ready',
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  // The script and its index start loading as the palette first opens, so
  // the first query does not wait on them.
  useEffect(() => {
    void loadPagefind().catch(() => undefined);
  }, []);

  useEffect(() => {
    setSearchError(null);
    if (typed.length < 2) return;
    let current = true;
    setSearch({ query: typed, rows: [], status: 'pending' });
    const timer = setTimeout(() => {
      if (!current) return;
      current = false;
      setSearch({ query: typed, rows: [], status: 'failed' });
      setSearchError(
        'Instant search is taking too long. Use the search page to continue.'
      );
    }, 10_000);
    searchSite(typed).then(
      (found) => {
        if (!current || found === null) return;
        clearTimeout(timer);
        setSearch({ query: typed, rows: found, status: 'ready' });
      },
      () => {
        if (!current) return;
        clearTimeout(timer);
        setSearch({ query: typed, rows: [], status: 'failed' });
        setSearchError(
          'Instant search is unavailable. Use the search page to continue.'
        );
      }
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [typed]);

  const searching =
    typed.length >= 2 &&
    (search.query !== typed || search.status === 'pending');
  const results =
    search.query === typed && search.status === 'ready' ? search.rows : [];
  return {
    rows: results,
    searching,
    error: search.query === typed ? searchError : null,
  };
}
