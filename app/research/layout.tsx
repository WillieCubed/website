'use client';

import { AnimatePresence } from 'framer-motion';
import React from 'react';

export default function ResearchLayout({ children }: React.PropsWithChildren) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {children}
    </AnimatePresence>
  );
}
