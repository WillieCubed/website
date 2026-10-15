'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { BUILTIN_CATALOG, type CatalogEntry } from '@/lib/studio/catalog';
import type { ComponentProposal } from '@/lib/studio/types';

import { studioRequest } from './api';

interface CatalogResponse {
  entries: CatalogEntry[];
}

export interface WritingCatalog {
  entries: CatalogEntry[];
  status: string;
  retry?: () => void;
  readEntries: () => CatalogEntry[];
  resolveApproved: (proposal: ComponentProposal) => Promise<CatalogEntry>;
}

/** One list serves React node views and the persistent editor's synchronous lookup. */
export function useWritingCatalog(): WritingCatalog {
  const [entries, setEntries] = useState<CatalogEntry[]>(BUILTIN_CATALOG);
  const currentEntries = useRef(entries);
  const requestVersion = useRef(0);
  const [status, setStatus] = useState('Loading widgets…');
  const [failed, setFailed] = useState(false);
  const readEntries = useCallback(() => currentEntries.current, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = ++requestVersion.current;
    setFailed(false);
    setStatus('Loading widgets…');
    try {
      const catalog = await studioRequest<CatalogResponse>('/catalog', {
        signal,
      });
      if (!signal?.aborted && version === requestVersion.current) {
        currentEntries.current = catalog.entries;
        setEntries(catalog.entries);
        setStatus('');
      }
      return catalog.entries;
    } catch (error) {
      if (!signal?.aborted && version === requestVersion.current) {
        setFailed(true);
        setStatus('Widgets could not load. Your writing is still available.');
      }
      throw error;
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [refresh]);
  function retry() {
    void refresh().catch(() => {});
  }
  async function resolveApproved(proposal: ComponentProposal) {
    const catalog = await refresh();
    const entry = catalog.find(
      (item) => item.id === proposal.id && item.version === proposal.version
    );
    if (!entry)
      throw new Error(
        'The approved widget is unavailable. Retry loading its catalog entry.'
      );
    return entry;
  }
  return {
    entries,
    status,
    retry: failed ? retry : undefined,
    readEntries,
    resolveApproved,
  };
}
