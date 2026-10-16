'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { Catalog, MusicMode } from '@/lib/music/presentation';

interface Options {
  mode: MusicMode;
  initiallyOpen: boolean;
  acceptCatalog: (catalog: Catalog) => void;
}

export function useMusicSetup({ mode, initiallyOpen, acceptCatalog }: Options) {
  const curateToggle = useRef<HTMLButtonElement>(null);
  const setupToggle = useRef<HTMLButtonElement>(null);
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
    if (catalog) curateToggle.current?.focus({ preventScroll: true });
    else setupToggle.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return {
    isOpen,
    curateToggle,
    setupToggle,
    open,
    cancel: () => leave(),
    complete: (catalog: Catalog) => leave(catalog),
    restore: setOpen,
  };
}
