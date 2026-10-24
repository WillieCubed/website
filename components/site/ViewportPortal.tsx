'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useHydrated } from '@/lib/dom/hydrated';

interface Props {
  children: ReactNode;
}

/** Viewport feedback escapes page clipping while retaining its server content. */
export default function ViewportPortal({ children }: Props) {
  return useHydrated() ? createPortal(children, document.body) : children;
}
