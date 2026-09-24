'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import type { PaletteData } from '@/lib/palette/types';

import Palette from './Palette';

/** The shared element name the trigger and the palette's card trade. */
const MORPH_NAME = 'palette';

export interface CloseOptions {
  /** Morph back into the trigger. Off when a navigation follows. */
  animate?: boolean;
  /** Return focus to what opened the palette. Off when a navigation follows. */
  restoreFocus?: boolean;
}

interface PaletteApi {
  /** Opens the palette, morphing out of `from` when it is on screen. */
  open: (from?: HTMLElement | null) => void;
  close: (options?: CloseOptions) => void;
  /** Lets a trigger offer itself as the morph source for ⌘K. */
  register: (trigger: HTMLElement) => () => void;
}

const PaletteContext = createContext<PaletteApi | null>(null);

export function usePalette(): PaletteApi {
  const api = useContext(PaletteContext);
  if (!api) throw new Error('usePalette needs a PaletteProvider above it.');
  return api;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Runs a DOM change inside a same-document view transition, so named
 * elements morph between their old and new boxes. Without the API it just
 * applies, and under reduced motion the palette's own CSS crossfades instead.
 * A transition the browser abandons still runs the update, so its rejection
 * is swallowed rather than left to strand the palette half open.
 */
function transition(update: () => void): Promise<void> {
  if (!document.startViewTransition || reducedMotion()) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => undefined);
}

/**
 * True when the element has a box inside the window. Next keeps the
 * previous page in the document with display: none after a soft
 * navigation, so a trigger that is merely in the DOM may not be on screen.
 */
function inViewport(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

/** True for ⌘K on Apple platforms and Ctrl+K elsewhere, with no other keys. */
function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

/** What the palette offers before its places arrive, or if they never do. */
const NO_PLACES: PaletteData = { writings: [], initiatives: [], ventures: [] };

let placesRequest: Promise<PaletteData> | null = null;

/**
 * The palette's places, fetched once per page load on first open
 * (app/api/palette). A failed request is forgotten so the next opening can
 * try again, and the palette still searches and runs its commands meanwhile.
 */
function loadPlaces(): Promise<PaletteData> {
  placesRequest ??= fetch('/api/palette')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<PaletteData>;
    })
    .catch((error: unknown) => {
      placesRequest = null;
      throw error;
    });
  return placesRequest;
}

/**
 * Owns the command palette: whether it is open, the ⌘K / Ctrl+K shortcut on
 * every page, and which trigger opened it. That trigger's container morphs
 * into the palette's card on the way in and back on the way out, and gets
 * focus back when the palette closes.
 */
export default function PaletteProvider({ children }: React.PropsWithChildren) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggers = useRef(new Set<HTMLElement>());
  // The element whose container became the card, hidden while it is open,
  // so the page never shows the trigger and the palette at once.
  const sourceRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  // Each opening starts a fresh session, so the input and results reset.
  const [session, setSession] = useState(0);
  const [data, setData] = useState<PaletteData>(NO_PLACES);

  const openPalette = useCallback(async (from?: HTMLElement | null) => {
    const dialog = dialogRef.current;
    if (!dialog || openRef.current || busyRef.current) return;
    busyRef.current = true;
    openRef.current = true;
    loadPlaces().then(setData, () => undefined);
    const focused = document.activeElement;
    returnFocusRef.current =
      from ?? (focused instanceof HTMLElement ? focused : null);
    // ⌘K has no element of its own, so it grows out of the page's trigger
    // when one is on screen and simply appears when none is.
    const source =
      [from, ...triggers.current].find(
        (element): element is HTMLElement => !!element && inViewport(element)
      ) ?? null;
    sourceRef.current = source;
    if (source) source.style.viewTransitionName = MORPH_NAME;
    await transition(() => {
      if (source) {
        source.style.viewTransitionName = '';
        source.style.visibility = 'hidden';
      }
      flushSync(() => {
        setSession((value) => value + 1);
        setOpen(true);
      });
      dialog.style.viewTransitionName = MORPH_NAME;
      if (!dialog.open) dialog.showModal();
    });
    // The name only matters while a transition captures it; left on, it
    // would join any other transition on the page, such as a detail view's.
    dialog.style.viewTransitionName = '';
    busyRef.current = false;
  }, []);

  const closePalette = useCallback(
    async ({ animate = true, restoreFocus = true }: CloseOptions = {}) => {
      const dialog = dialogRef.current;
      if (!dialog || !openRef.current || busyRef.current) return;
      busyRef.current = true;
      openRef.current = false;
      const source = sourceRef.current;
      sourceRef.current = null;
      // The trigger is hidden, not gone, so its box still says where it is.
      const target = animate && source && inViewport(source) ? source : null;
      const update = () => {
        dialog.style.viewTransitionName = '';
        if (dialog.open) dialog.close();
        flushSync(() => setOpen(false));
        if (source) source.style.visibility = '';
        if (target) target.style.viewTransitionName = MORPH_NAME;
      };
      if (animate) {
        dialog.style.viewTransitionName = MORPH_NAME;
        await transition(update);
      } else {
        update();
      }
      if (target) target.style.viewTransitionName = '';
      // Focus lands once the card has shrunk back, so the trigger's focus
      // ring is not caught in the snapshot and dragged through the morph.
      if (restoreFocus) returnFocusRef.current?.focus({ preventScroll: true });
      returnFocusRef.current = null;
      busyRef.current = false;
    },
    []
  );

  const register = useCallback((trigger: HTMLElement) => {
    triggers.current.add(trigger);
    return () => {
      triggers.current.delete(trigger);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      if (openRef.current) void closePalette();
      else void openPalette(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPalette, closePalette]);

  const api = useMemo<PaletteApi>(
    () => ({
      open: (from) => void openPalette(from),
      close: (options) => void closePalette(options),
      register,
    }),
    [openPalette, closePalette, register]
  );

  return (
    <PaletteContext value={api}>
      {children}
      <Palette
        ref={dialogRef}
        data={data}
        open={open}
        session={session}
        onClose={api.close}
        onForcedClose={() => {
          // The browser closed the dialog without asking, such as a second
          // Escape in a row. Put the page back the way closing would.
          if (!openRef.current) return;
          openRef.current = false;
          busyRef.current = false;
          if (sourceRef.current) sourceRef.current.style.visibility = '';
          sourceRef.current = null;
          setOpen(false);
          returnFocusRef.current?.focus({ preventScroll: true });
          returnFocusRef.current = null;
        }}
      />
    </PaletteContext>
  );
}
