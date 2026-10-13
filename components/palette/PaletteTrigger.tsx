'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import Icon from '@/components/icons/Icon';

import { usePalette } from './PaletteProvider';
import './palette.css';

const subscribe = () => () => {};

/**
 * ⌘ on Apple platforms, Ctrl elsewhere. The server cannot know, so it
 * renders no hint and the client fills it in after hydration.
 */
function useShortcutLabel(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const platform =
        (navigator as Navigator & { userAgentData?: { platform?: string } })
          .userAgentData?.platform || navigator.platform;
      return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K';
    },
    () => null
  );
}

interface PaletteTriggerProps {
  /**
   * `rail` is the homepage's search bar with the shortcut hint; `compact`
   * is the top bar's smaller button.
   */
  size: 'rail' | 'compact';
  glass?: boolean;
}

/**
 * Opens the command palette. The button is a tonal container that grows
 * into the palette's card and shrinks back into it on close.
 */
export default function PaletteTrigger({
  size,
  glass = false,
}: PaletteTriggerProps) {
  const { open, register } = usePalette();
  const ref = useRef<HTMLButtonElement>(null);
  const shortcut = useShortcutLabel();

  useEffect(() => {
    if (!ref.current) return;
    return register(ref.current);
  }, [register]);

  return (
    // A native submission keeps search usable before hydration and without JS.
    <form
      action="/search"
      className="palette-trigger-form"
      onSubmit={(event) => {
        event.preventDefault();
        open(ref.current);
      }}
    >
      <button
        ref={ref}
        type="submit"
        className={`palette-trigger palette-trigger--${size}${glass ? ' site-glass' : ''}`}
        aria-haspopup="dialog"
        aria-label={size === 'compact' ? 'Search' : 'Search or jump to'}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Icon name="search" size={size === 'rail' ? 20 : 18} />
        <span className="palette-trigger__label">
          {size === 'rail' ? 'Search or jump to…' : 'Search'}
        </span>
        {/* Hidden from the accessible name, which aria-keyshortcuts covers. */}
        <kbd className="palette-trigger__key" aria-hidden="true">
          {shortcut}
        </kbd>
      </button>
    </form>
  );
}
