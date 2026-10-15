'use client';
import { useEffect, useRef } from 'react';

import type { Catalog } from '@/lib/music/presentation';

/** Adopt incoming data once the pending collection becomes available. */
export function useMusicCatalogLoading(
  loading: boolean,
  initialCatalog: Catalog,
  setupInitially: boolean,
  restore: (catalog: Catalog, setup: boolean) => void
) {
  const wasLoading = useRef(loading);
  useEffect(() => {
    if (wasLoading.current && !loading) restore(initialCatalog, setupInitially);
    wasLoading.current = loading;
  }, [loading, initialCatalog, setupInitially]);
}
