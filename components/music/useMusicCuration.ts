'use client';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import type { Catalog, MusicMode } from '@/lib/music/presentation';

import type { MusicCatalogDocument } from './useMusicCatalog';
import { useMusicSetup } from './useMusicSetup';

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
    mode,
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
    if (mode !== 'prototype') {
      await onPublish?.(catalogDocument.draft);
      return;
    }
    flushSync(() => {
      catalogDocument.apply();
      setEditing(false);
      clearFilter();
    });
    announce('Changes applied to this prototype.');
    setup.curateToggle.current?.focus();
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
