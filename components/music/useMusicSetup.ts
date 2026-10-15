'use client';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import type { Catalog, MusicMode } from '@/lib/music/presentation';

interface Options {
  mode: MusicMode;
  initiallyOpen: boolean;
  acceptCatalog: (catalog: Catalog) => void;
  focusCuration: () => void;
  focusSetup: () => void;
}

export function useMusicSetup({
  mode,
  initiallyOpen,
  acceptCatalog,
  focusCuration,
  focusSetup,
}: Options) {
  const [isOpen, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    if (mode === 'prototype')
      setOpen(new URLSearchParams(location.search).has('setup'));
  }, []);

  function open() {
    if (mode === 'prototype') {
      const url = new URL(location.href);
      url.search = '?setup';
      history.replaceState(null, '', url);
    }
    setOpen(true);
  }

  function leave(catalog?: Catalog) {
    const url = new URL(location.href);
    url.searchParams.delete('setup');
    history.replaceState(null, '', url);
    flushSync(() => {
      if (catalog) acceptCatalog(catalog);
      setOpen(false);
    });
    if (catalog) focusCuration();
    else focusSetup();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return {
    isOpen,
    open,
    cancel: () => leave(),
    complete: (catalog: Catalog) => leave(catalog),
    restore: setOpen,
  };
}
