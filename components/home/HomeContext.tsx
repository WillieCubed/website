'use client';

import { createContext, useContext } from 'react';

import type { BrandKey, BrandSchemes } from '@/lib/brand/scheme';
import type { FocusId } from '@/lib/home/focuses';

/**
 * What the visitor is pointing at: a focus in the rail or one entry. A focus
 * switched on by a tap is `pinned`, which is the only preview that reorders
 * the stacked feed; a hover or keyboard preview never moves anything.
 */
export type Preview =
  | { focus: FocusId; pinned?: boolean }
  | { id: string }
  | null;

/**
 * Whether a focus row is switched on. Previewing an entry marks the rows for
 * its focuses, but only the row's own preview presses it.
 */
export function isFocusPressed(preview: Preview, focus: FocusId): boolean {
  return (
    preview !== null &&
    'focus' in preview &&
    preview.focus === focus &&
    preview.pinned === true
  );
}

export interface HomePreviewState {
  preview: Preview;
  matches: (id: string) => boolean;
  lit: FocusId[];
}

export interface HomeActions {
  setPreview: (value: Preview) => void;
  clearPreview: () => void;
  clearPreviewNow: () => void;
  openDetail: (id: string, from: HTMLElement | null) => void;
  brands: BrandSchemes;
}

export const HomeContext = createContext<HomePreviewState | null>(null);
export const HomeActionsContext = createContext<HomeActions | null>(null);

export function useHome(): HomePreviewState {
  const value = useContext(HomeContext);
  if (!value) throw new Error('useHome must be used inside HomeShell');
  return value;
}

export function useHomeActions(): HomeActions {
  const value = useContext(HomeActionsContext);
  if (!value) throw new Error('useHomeActions must be used inside HomeShell');
  return value;
}

/** Pointer and focus handlers that preview a focus or an entry. */
export function usePreviewHandlers(value: Exclude<Preview, null>) {
  const { setPreview, clearPreview } = useHomeActions();
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
  brands: BrandSchemes,
  brand: BrandKey | undefined
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
