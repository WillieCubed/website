'use client';
import { useEffect, useRef } from 'react';

import type { Catalog } from '@/lib/music/presentation';

import { useMusicCatalog } from './useMusicCatalog';

interface MusicDocumentSource {
  initialCatalog: Catalog;
  onChange?: (catalog: Catalog) => void;
  loading?: boolean;
  setupInitially?: boolean;
}
/** Restore both catalog copies from their source without treating hydration as an edit. */
export function useMusicDocument(
  {
    initialCatalog,
    onChange,
    loading = false,
    setupInitially = false,
  }: MusicDocumentSource,
  restoreSetup: (open: boolean) => void
) {
  const document = useMusicCatalog(initialCatalog, onChange);
  // Adopt incoming data once the pending collection becomes available.
  const wasLoading = useRef(loading);
  useEffect(() => {
    if (wasLoading.current && !loading) {
      document.restore(initialCatalog);
      restoreSetup(setupInitially);
    }
    wasLoading.current = loading;
  }, [loading, initialCatalog, setupInitially]);
  const changed =
    JSON.stringify(document.live) !== JSON.stringify(document.draft);
  return { document, changed };
}
