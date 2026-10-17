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

import {
  inViewport,
  isPaletteShortcut,
  morphTarget,
  transition,
  underModal,
} from '@/lib/search/palette/morph';
import { NO_PLACES, loadPlaces } from '@/lib/search/palette/places';
import type { CloseOptions, PaletteData } from '@/lib/search/palette/types';
import type { Command } from '@/lib/search/palette/types';

import Palette from './Palette';

/** The shared element name the trigger and the palette's card trade. */
const MORPH_NAME = 'palette';

interface PaletteApi {
  /** Opens the palette, morphing out of `from` when it is on screen. */
  open: (from?: HTMLElement | null) => void;
  close: (options?: CloseOptions) => Promise<void>;
  /** Lets a trigger offer itself as the morph source for ⌘K. */
  register: (trigger: HTMLElement) => () => void;
  registerCommands: (commands: Command[]) => () => void;
}

const PaletteContext = createContext<PaletteApi | null>(null);

export function usePalette(): PaletteApi {
  const api = useContext(PaletteContext);
  if (!api) throw new Error('usePalette needs a PaletteProvider above it.');
  return api;
}

interface QueuedPaletteClose {
  close: CloseOptions;
}
interface QueuedPaletteOpen {
  open: HTMLElement | null | undefined;
}
type QueuedPaletteOperation = QueuedPaletteClose | QueuedPaletteOpen;

/**
 * Owns the command palette: whether it is open, the ⌘K / Ctrl+K shortcut on
 * every page, and which trigger opened it. That trigger's container morphs
 * into the palette's card on the way in and back on the way out, and gets
 * focus back when the palette closes.
 */
export default function PaletteProvider({ children }: React.PropsWithChildren) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggers = useRef(new Set<HTMLElement>());
  const { contextCommands, registerCommands } = usePaletteCommands();
  // The element whose container became the card, hidden while it is open,
  // so the page never shows the trigger and the palette at once.
  const sourceRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const busyRef = useRef(false);
  // A close or an opening asked for while the palette is still morphing the
  // other way, such as Escape mid-morph or a command that navigates. It
  // runs once the morph ends rather than being dropped.
  const queuedRef = useRef<QueuedPaletteOperation | null>(null);
  const [open, setOpen] = useState(false);
  // Each opening starts a fresh session, so the input and results reset.
  const [session, setSession] = useState(0);
  const [data, setData] = useState<PaletteData>(NO_PLACES);

  // Declared before either morph so each can hand over what arrived while
  // it ran; the ref keeps the latest pair without a dependency cycle.
  const morphsRef = useRef({
    open: (_from?: HTMLElement | null) => Promise.resolve(),
    close: (_options?: CloseOptions) => Promise.resolve(),
  });
  const runQueued = () => {
    const queued = queuedRef.current;
    queuedRef.current = null;
    if (!queued) return;
    if ('close' in queued) void morphsRef.current.close(queued.close);
    else void morphsRef.current.open(queued.open);
  };

  const openPalette = useCallback(async (from?: HTMLElement | null) => {
    const dialog = dialogRef.current;
    if (!dialog || openRef.current) return;
    if (busyRef.current) {
      queuedRef.current = { open: from };
      return;
    }
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
        (element): element is HTMLElement =>
          !!element && inViewport(element) && !underModal(element, dialog)
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
    runQueued();
  }, []);

  const restorePaletteFocus = (restore: boolean) => {
    if (restore) returnFocusRef.current?.focus({ preventScroll: true });
    returnFocusRef.current = null;
  };

  const closePalette = useCallback(
    async ({ animate = true, restoreFocus = true }: CloseOptions = {}) => {
      const dialog = dialogRef.current;
      if (!dialog || !openRef.current) return;
      if (busyRef.current) {
        queuedRef.current = { close: { animate, restoreFocus } };
        return;
      }
      busyRef.current = true;
      openRef.current = false;
      const source = sourceRef.current;
      sourceRef.current = null;
      // The trigger is hidden, not gone, so its box still says where it is.
      const target = morphTarget(source, dialog, animate);
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
      restorePaletteFocus(restoreFocus);
      busyRef.current = false;
      runQueued();
    },
    []
  );

  morphsRef.current = { open: openPalette, close: closePalette };

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
      close: (options) => closePalette(options),
      register,
      registerCommands,
    }),
    [openPalette, closePalette, register, registerCommands]
  );

  return (
    <PaletteContext value={api}>
      {children}
      <Palette
        ref={dialogRef}
        data={data}
        contextCommands={contextCommands}
        open={open}
        session={session}
        onClose={api.close}
        onForcedClose={() => {
          // The browser closed the dialog without asking, such as a second
          // Escape in a row. Put the page back the way closing would.
          if (!openRef.current) return;
          openRef.current = false;
          busyRef.current = false;
          queuedRef.current = null;
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

/** Keeps page commands registered for exactly their owner's mounted lifetime. */
function usePaletteCommands() {
  const commandRegistry = useRef(new Map<symbol, Command[]>());
  const [contextCommands, setContextCommands] = useState<Command[]>([]);
  const registerCommands = useCallback((commands: Command[]) => {
    const key = Symbol('palette commands');
    commandRegistry.current.set(key, commands);
    setContextCommands([...commandRegistry.current.values()].flat());
    return () => {
      commandRegistry.current.delete(key);
      setContextCommands([...commandRegistry.current.values()].flat());
    };
  }, []);

  return { contextCommands, registerCommands };
}
