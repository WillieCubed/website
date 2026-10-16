'use client';
import type { Catalog, MusicMode } from '@/lib/music/presentation';

import { useMusicCatalog } from './useMusicCatalog';
import { useMusicCatalogLoading } from './useMusicCatalogLoading';
import { usePrototypeMusicCatalog } from './usePrototypeMusicCatalog';

interface MusicDocumentSource {
  initialCatalog: Catalog;
  onChange?: (catalog: Catalog) => void;
  loading?: boolean;
  setupInitially?: boolean;
  mode?: MusicMode;
  validCatalog?: (value: unknown) => value is Catalog;
}
/** Restore both catalog copies from their source without treating hydration as an edit. */
export function useMusicDocument(
  {
    initialCatalog,
    onChange,
    loading = false,
    setupInitially = false,
    mode = 'public',
    validCatalog,
  }: MusicDocumentSource,
  restoreSetup: (open: boolean) => void
) {
  const document = useMusicCatalog(initialCatalog, onChange);
  useMusicCatalogLoading(
    loading,
    initialCatalog,
    setupInitially,
    (next, showSetup) => {
      document.restore(next, next);
      restoreSetup(showSetup);
    }
  );
  const prototype = usePrototypeMusicCatalog({
    mode,
    live: document.live,
    draft: document.draft,
    validCatalog,
    restore: document.restore,
  });
  const changed =
    JSON.stringify(document.live) !== JSON.stringify(document.draft);
  return { document, prototype, changed };
}
