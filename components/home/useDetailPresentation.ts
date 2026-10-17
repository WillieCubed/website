'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { prefersReducedMotion } from './HomeContext';

interface Source {
  /** The entry the source stands for, which a swap can leave behind. */
  id: string;
  card: HTMLElement;
  media: HTMLElement | null;
}

const setName = (el: HTMLElement | null, value: string) => {
  if (el) el.style.viewTransitionName = value;
};

function restoreDetailFocus(element: HTMLElement | null) {
  if (element?.isConnected && !document.querySelector('dialog[open]')) {
    element.focus({ preventScroll: true });
  }
}

// Every DOM change happens inside the transition callback so the browser can
// morph the old and new snapshots. Without the API, or under reduced motion,
// the change just applies. A transition the browser abandons, such as one
// started in a background tab, still runs the update, so its rejection is
// swallowed rather than left to strand the dialog mid-open.
//
// `kind` sits on the root while the morph runs, so the stylesheet can give the
// card's clipped box the shadow its snapshot loses.
const morph = (
  kind: 'open' | 'swap' | 'close',
  update: () => void
): Promise<void> => {
  if (document.startViewTransition == null || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }
  const root = document.documentElement;
  root.dataset.detailMorph = kind;
  const started = document.startViewTransition(update);
  // An abandoned transition rejects ready as well as finished, and nothing
  // else awaits ready, so without this every abort is an unhandled rejection.
  started.ready.catch(() => undefined);
  return started.finished
    .catch(() => undefined)
    .finally(() => {
      delete root.dataset.detailMorph;
    });
};

/**
 * The part of a tile and of its detail view that shows the same thing, such
 * as the countdown's number or the screenshot, carries `data-morph` set to
 * the entry's id on both sides. It moves on its own; the words around it
 * ride inside the card, so no text is stretched or faded into different
 * text, and an entry without a matching pair moves only its card.
 */
const mediaIn = (root: Element | null, id: string) =>
  root?.querySelector<HTMLElement>(`[data-morph="${CSS.escape(id)}"]`) ?? null;

// The shared element is whatever the visitor actually touched: a product
// card, a tile, or a venture's name in the rail's description.
function sourceFor(id: string, from: HTMLElement | null): Source | null {
  if (from?.classList.contains('product')) {
    return { id, card: from, media: mediaIn(from, id) };
  }
  const name = from?.closest<HTMLElement>('.venture-link');
  if (name) return { id, card: name, media: null };
  const tile = document.getElementById(id);
  if (tile) return { id, card: tile, media: mediaIn(tile, id) };
  // A product opened by URL grows out of the studio's tile. Its own card can
  // be scrolled out of the studio's row, so only the tile moves.
  const studio = document.getElementById('hypertext');
  return studio ? { id, card: studio, media: null } : null;
}

/** Owns the dialog DOM, matching morph sources and return focus. */
export function useDetailPresentation(
  initial: string | null,
  clearPreviewNow: () => void
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<Source | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selfClosedRef = useRef(false);
  const [openId, setOpenId] = useState<string | null>(initial);
  const show = async (
    id: string,
    from: HTMLElement | null,
    stillWanted: () => boolean
  ): Promise<boolean> => {
    // Opening from the URL can run before the page's fonts load, and the
    // snapshot would catch the tile in its fallback face.
    if (!from) await document.fonts.ready;
    // A close or Back during the wait stands; opening now would only flash
    // the view before settle closes it again.
    if (!stillWanted()) return false;
    const source = sourceFor(id, from);
    const dialog = dialogRef.current;
    if (!source || !dialog) return false;
    returnFocusRef.current = from;
    flushSync(() => clearPreviewNow());
    setName(source.card, 'card');
    setName(source.media, 'media');
    sourceRef.current = source;
    let media: HTMLElement | null = null;
    await morph('open', () => {
      setName(source.card, '');
      setName(source.media, '');
      source.card.style.visibility = 'hidden';
      flushSync(() => setOpenId(id));
      media = source.media && mediaIn(mediaRef.current, id);
      setName(dialog, 'card');
      setName(media, 'media');
      if (!dialog.matches(':modal')) {
        if (dialog.open) dialog.close();
        dialog.showModal();
      }
      dialog.scrollTop = 0;
    });
    // Names only matter while a transition captures them. Left on, the open
    // view would join the next one on the page, such as the command
    // palette's.
    setName(dialog, '');
    setName(media, '');
    return true;
  };

  // Moving from the studio to one of its products keeps the dialog in place
  // and crossfades its contents, so it reads as going deeper.
  const swap = async (id: string) => {
    const dialog = dialogRef.current;
    setName(dialog, 'card');
    await morph('swap', () => {
      flushSync(() => setOpenId(id));
      if (dialog) dialog.scrollTop = 0;
    });
    setName(dialog, '');
  };

  const hide = async (shown: string | null) => {
    const opened = sourceRef.current;
    const dialog = dialogRef.current;

    if (!dialog || !shown) return;
    // After a swap the view shows another entry than the one it opened
    // from, and it shrinks back into that entry's own tile and picture.
    const source = opened?.id === shown ? opened : sourceFor(shown, null);
    const media = source?.media ? mediaIn(mediaRef.current, shown) : null;
    setName(dialog, 'card');
    setName(media, 'media');
    await morph('close', () => {
      setName(dialog, '');
      setName(media, '');
      if (dialog.open) {
        selfClosedRef.current = true;
        dialog.close();
      }
      if (opened) opened.card.style.visibility = '';
      if (source) {
        setName(source.card, 'card');
        setName(source.media, 'media');
      }
    });
    if (source) {
      setName(source.card, '');
      setName(source.media, '');
    }
    sourceRef.current = null;
    setOpenId(null);
    const returnFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    restoreDetailFocus(returnFocus);
  };

  useEffect(() => {
    const modal = dialogRef.current;
    if (!initial || !modal || modal.matches(':modal')) return;
    // Upgrade the readable server dialog on the same node.
    modal.close();
    modal.showModal();
  }, []);
  const consumePresentationClose = () => {
    const selfClosed = selfClosedRef.current;
    selfClosedRef.current = false;
    return selfClosed;
  };
  return {
    openId,
    dialogRef,
    mediaRef,
    consumePresentationClose,
    show,
    swap,
    hide,
  };
}
