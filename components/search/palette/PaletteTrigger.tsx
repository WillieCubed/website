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
        data-control-size={size === 'rail' ? 'medium' : undefined}
        className={`palette-trigger site-control [font-family:inherit] [line-height:inherit] no-underline ${size === 'rail' ? 'w-full max-w-[720px] gap-3 py-0 pr-6 pl-5 text-base [--control-rest-radius:28px]' : 'palette-trigger--compact gap-2 py-0 pr-4 pl-3 text-sm leading-5 font-semibold [--control-rest-radius:20px] max-[599px]:p-0'}${glass ? ' site-glass' : ''}`}
        aria-haspopup="dialog"
        aria-label={size === 'compact' ? 'Search' : 'Search or jump to'}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Icon
          name="search"
          size={size === 'rail' ? 20 : 18}
          className="flex-none"
        />
        <span
          className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap${size === 'compact' ? ' max-[599px]:absolute max-[599px]:size-px max-[599px]:[clip-path:inset(50%)]' : ''}`}
        >
          {size === 'rail' ? 'Search or jump to…' : 'Search'}
        </span>
        {/* Hidden from the accessible name, which aria-keyshortcuts covers. */}
        <kbd
          className={`palette-trigger__key ml-auto font-mono text-[13px] leading-none font-medium tracking-[.02em]${size === 'compact' ? ' hidden' : ''}`}
          aria-hidden="true"
        >
          {shortcut}
        </kbd>
      </button>
    </form>
  );
}
