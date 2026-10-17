'use client';
import type { Catalog } from '@/lib/music/presentation';

import { useMusicCatalog } from './useMusicCatalog';
import { useMusicCatalogLoading } from './useMusicCatalogLoading';

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
  useMusicCatalogLoading(
    loading,
    initialCatalog,
    setupInitially,
    (next, showSetup) => {
      document.restore(next);
      restoreSetup(showSetup);
    }
  );
  const changed =
    JSON.stringify(document.live) !== JSON.stringify(document.draft);
  return { document, changed };
}
