'use client';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import type { Catalog } from '@/lib/music/presentation';

interface Options {
  initiallyOpen: boolean;
  acceptCatalog: (catalog: Catalog) => void;
}

export function useMusicSetup({ initiallyOpen, acceptCatalog }: Options) {
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
