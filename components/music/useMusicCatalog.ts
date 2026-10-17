'use client';
import { useState } from 'react';

import type { Catalog } from '@/lib/music/presentation';

export interface MusicCatalogDocument {
  live: Catalog;
  draft: Catalog;
  commit: (next: Catalog) => void;
  acceptSetup: (next: Catalog) => void;
  restore: (catalog: Catalog) => void;
}

/** The applied catalog and the editable copy have separate update paths. */
export function useMusicCatalog(
  initialCatalog: Catalog,
  onChange?: (catalog: Catalog) => void
): MusicCatalogDocument {
  const [live, setLive] = useState(initialCatalog);
  const [draft, setDraft] = useState(initialCatalog);

  function commit(next: Catalog) {
    onChange?.(next);
    setDraft(next);
  }
  function acceptSetup(next: Catalog) {
    setDraft(next);
    onChange?.(next);
  }
  function restore(catalog: Catalog) {
    setLive(catalog);
    setDraft(catalog);
  }
  return { live, draft, commit, acceptSetup, restore };
}
