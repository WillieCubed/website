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
}

/**
 * Opens the command palette. The button is a tonal container that grows
 * into the palette's card and shrinks back into it on close.
 */
export default function PaletteTrigger({ size }: PaletteTriggerProps) {
  const { open, register } = usePalette();
  const ref = useRef<HTMLAnchorElement>(null);
  const shortcut = useShortcutLabel();

  useEffect(() => {
    if (!ref.current) return;
    return register(ref.current);
  }, [register]);

  return (
    // A link to /search until scripts run, so the trigger still leads
    // somewhere for a visitor without them; once hydrated it opens the
    // palette instead.
    <a
      ref={ref}
      href="/search"
      className={`palette-trigger palette-trigger--${size}`}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        open(event.currentTarget);
      }}
    >
      <Icon name="search" size={size === 'rail' ? 20 : 18} />
      <span className="palette-trigger__label">
        {size === 'rail' ? 'Search or jump to…' : 'Search'}
      </span>
      {/* Hidden from the accessible name, which aria-keyshortcuts covers. */}
      <kbd className="palette-trigger__key" aria-hidden="true">
        {shortcut}
      </kbd>
    </a>
  );
}
