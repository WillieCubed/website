'use client';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import type { Catalog, MusicMode } from '@/lib/music/presentation';

import type { MusicCatalogDocument } from './useMusicCatalog';

interface Options {
  mode: MusicMode;
  catalogDocument: MusicCatalogDocument;
  onPublish?: (reviewed: Catalog) => Promise<void>;
  clearFilter: () => void;
  setupInitially: boolean;
  resetSelection: () => void;
}
/** A curation session owns editing mode, mutation announcements, and applying its draft. */
export function useMusicCuration({
  mode,
  catalogDocument,
  onPublish,
  clearFilter,
  setupInitially,
  resetSelection,
}: Options) {
  const [editing, setEditing] = useState(mode === 'admin');
  const [announcement, announce] = useState('');
  const setup = useMusicSetup({
    initiallyOpen: setupInitially,
    acceptCatalog: (next) => {
      catalogDocument.acceptSetup(next);
      setEditing(true);
      resetSelection();
    },
  });
  function changeCatalog(next: Catalog) {
    catalogDocument.commit(next);
    announce('Draft saved in this browser.');
  }
  function toggle() {
    setEditing(!editing);
    clearFilter();
  }
  async function applyReview() {
    await onPublish?.(catalogDocument.draft);
  }
  return {
    editing,
    setup,
    announcement,
    announce,
    changeCatalog,
    toggle,
    applyReview,
  };
}

interface SetupOptions {
  initiallyOpen: boolean;
  acceptCatalog: (catalog: Catalog) => void;
}

function useMusicSetup({ initiallyOpen, acceptCatalog }: SetupOptions) {
  const [isOpen, setOpen] = useState(initiallyOpen);

  function leave(catalog?: Catalog) {
    flushSync(() => {
      if (catalog) acceptCatalog(catalog);
      setOpen(false);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return {
    isOpen,
    open: () => setOpen(true),
    cancel: () => leave(),
    complete: (catalog: Catalog) => leave(catalog),
    restore: setOpen,
  };
}
