'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { entries } from '@/lib/home/ventures';

import { prefersReducedMotion, useHome } from './HomeContext';

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
  if (!document.startViewTransition || prefersReducedMotion()) {
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

// The detail view's pictures are never lazy: the morph snapshots the dialog
// as soon as it opens, and the tile or row it grew from has usually loaded
// the same file already.
interface DetailDialogProps {
  /** Lets the shell hand `openDetail` calls from tiles and rows here. */
  registerOpener: (
    open: (id: string, from: HTMLElement | null) => void
  ) => void;
  countdown: React.ReactNode;
}

/** A router call this view made whose result the URL does not show yet. */
interface PendingUrl {
  /** The `detail` param the call leads to. */
  id: string | null;
  /** Whether it adds a history entry, so Back undoes it. */
  push: boolean;
}

export function useDetailDialog(
  registerOpener: DetailDialogProps['registerOpener'],
  initialId?: string
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get('detail');

  const { brands, clearPreviewNow } = useHome();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const initial = initialId && entries[initialId] ? initialId : null;
  const [openId, setOpenId] = useState<string | null>(initial);
  const shownRef = useRef<string | null>(initial);
  const wantRef = useRef<string | null>(initial);
  // The element the next opening grows out of, when a click asked for it.
  const fromRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const sourceRef = useRef<Source | null>(null);
  const busyRef = useRef(false);
  // The param as of the latest render, for code that runs after a morph.
  const requestedRef = useRef(requested);
  const pendingRef = useRef<PendingUrl | null>(null);
  // The current history entry is the one opening pushed, so closing can go
  // back to the page the visitor opened the view from.
  const ownEntryRef = useRef(false);
  // hide() closed the dialog itself, and its close event is still to come.
  const selfClosedRef = useRef(false);

  const show = async (id: string): Promise<boolean> => {
    const from = fromRef.current;
    fromRef.current = null;
    // Opening from the URL can run before the page's fonts load, and the
    // snapshot would catch the tile in its fallback face.
    if (!from) await document.fonts.ready;
    // A close or Back during the wait stands; opening now would only flash
    // the view before settle closes it again.
    if (wantRef.current !== id) return false;
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
        if (dialog.open) {
          selfClosedRef.current = true;
          dialog.close();
        }
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

  const hide = async () => {
    const opened = sourceRef.current;
    const dialog = dialogRef.current;
    const shown = shownRef.current;
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

  // Once the dialog shows what the visitor picked, the URL follows. A view
  // the URL does not name yet gets an entry of its own, so Back closes it;
  // a move within the view keeps the entry it has.
  const followUrl = () => {
    const shown = shownRef.current;
    if (shown === null || wantRef.current !== shown) return;
    const pending = pendingRef.current;
    const named = pending ? pending.id : requestedRef.current;
    // A param that names no entry was not ours to write, and the view kept
    // what it showed; rewriting it would overwrite the visitor's entry.
    if (named === shown || (named !== null && !entries[named])) return;
    const push = named === null || !!pending?.push;
    pendingRef.current = { id: shown, push };
    const href = `${pathname}?detail=${shown}`;
    if (push) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };

  const settle = async () => {
    if (busyRef.current) return;
    const want = wantRef.current;
    const shown = shownRef.current;
    if (want === shown) return;
    busyRef.current = true;
    try {
      if (want === null) {
        await hide();
        shownRef.current = null;
      } else if (!entries[want]) {
        // A stale or mistyped link should not close a view the visitor is
        // reading, so an id with no entry keeps what is on screen.
        if (wantRef.current === want) wantRef.current = shown;
      } else if (shown === null) {
        if (await show(want)) shownRef.current = want;
        else if (wantRef.current === want) wantRef.current = null;
      } else {
        await swap(want);
        shownRef.current = want;
      }
    } finally {
      busyRef.current = false;
    }
    followUrl();
    void settle();
  };

  const requestClose = () => {
    wantRef.current = null;
    fromRef.current = null;
    const pending = pendingRef.current;
    // Back only while the entry opening pushed is the current one; going
    // back from anywhere else could take the visitor off the page they came
    // to see. A swap's replace still on its way is discarded by the router
    // when Back starts, so it cannot land on the entry before.
    if (ownEntryRef.current) {
      pendingRef.current = { id: null, push: false };
      router.back();
    } else if (requestedRef.current !== null || pending?.id) {
      // Replacing also cancels an opening's push the router has not
      // finished, which would otherwise reopen the view when it lands.
      pendingRef.current =
        requestedRef.current === null ? null : { id: null, push: false };
      router.replace(pathname, { scroll: false });
    }
    ownEntryRef.current = false;
    void settle();
  };

  const backdrop = useBackdropDismiss(requestClose);

  useEffect(() => {
    const modal = dialogRef.current;
    if (!initial || !modal || modal.matches(':modal')) return;
    // The server's open dialog is already readable. Upgrade the same node.
    selfClosedRef.current = true;
    modal.close();
    modal.showModal();
  }, []);

  useEffect(() => {
    registerOpener((id, from) => {
      wantRef.current = id;
      fromRef.current = from;
      void settle();
    });
  });

  useEffect(() => {
    requestedRef.current = requested;
    const pending = pendingRef.current;
    if (pending && pending.id === requested) {
      pendingRef.current = null;
      if (pending.push) ownEntryRef.current = true;
      return;
    }
    // A change this view did not make: Back, Forward, a link, or the command
    // palette.
    pendingRef.current = null;
    ownEntryRef.current = false;
    wantRef.current = requested;
    void settle();
    // The handlers read refs, so only the param needs to retrigger this.
  }, [requested]);

  return {
    brands,
    openId,
    dialogRef,
    mediaRef,
    selfClosedRef,
    wantRef,
    requestClose,
    backdrop,
    settle,
  };
}
