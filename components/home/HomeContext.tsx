'use client';

import { createContext, useContext } from 'react';

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
  return preview !== null && 'focus' in preview && preview.focus === focus;
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
  /** The focus rows marked for the current preview. */
  lit: FocusId[];
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

/** Pointer and focus handlers that preview a focus or an entry. */
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
