'use client';

import { createContext, useContext } from 'react';

import type { Facet } from '@/lib/home/ventures';

/** What the visitor is pointing at: a facet key or one entry. */
export type Preview = { facet: Facet } | { id: string } | null;

/**
 * Whether a facet key is switched on. Previewing an entry lights the keys for
 * its facets, but only the key's own preview presses it.
 */
export function isFacetPressed(preview: Preview, facet: Facet): boolean {
  return preview !== null && 'facet' in preview && preview.facet === facet;
}

export interface HomeContextValue {
  preview: Preview;
  /** Set the preview right away, cancelling any pending clear. */
  setPreview: (value: Preview) => void;
  /** Clear the preview after the leave debounce. */
  clearPreview: () => void;
  /** Clear the preview right away, before opening a detail. */
  clearPreviewNow: () => void;
  /** Whether an entry matches the current preview. */
  matches: (id: string) => boolean;
  /** The facet keys that should be underlined for the current preview. */
  lit: Facet[];
  /** Open an entry's detail view, morphing from the element that was used. */
  openDetail: (id: string, from: HTMLElement | null) => void;
  /** Material 3 custom properties per brand key, computed on the server. */
  brands: Record<string, Record<string, string>>;
}

export const HomeContext = createContext<HomeContextValue | null>(null);

export function useHome(): HomeContextValue {
  const value = useContext(HomeContext);
  if (!value) throw new Error('useHome must be used inside HomeShell');
  return value;
}

/** Pointer and focus handlers that preview a facet or an entry. */
export function usePreviewHandlers(value: Exclude<Preview, null>) {
  const { setPreview, clearPreview } = useHome();
  return {
    onPointerEnter: () => setPreview(value),
    onPointerLeave: clearPreview,
    onFocus: () => setPreview(value),
    onBlur: clearPreview,
  };
}

/**
 * Inline style carrying a brand's custom properties. React accepts custom
 * properties in style objects, but CSSProperties does not name them.
 */
export function brandStyle(
  brands: Record<string, Record<string, string>>,
  brand: string | undefined
): React.CSSProperties | undefined {
  const vars = brand ? brands[brand] : undefined;
  return vars && Object.keys(vars).length > 0
    ? (vars as React.CSSProperties)
    : undefined;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
