'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { entries } from '@/lib/home/ventures';

import { useHomeActions } from './HomeContext';
import { useDetailPresentation } from './useDetailPresentation';

// Detail images load eagerly. Opening retains the tile's decoded source for
// the morph before allowing the destination's larger responsive candidate.
interface DetailDialogProps {
  /** Lets the shell hand `openDetail` calls from tiles and rows here. */
  registerOpener: (
    open: (id: string, from: HTMLElement | null) => void
  ) => void;
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

  const { clearPreviewNow } = useHomeActions();
  const initial = initialId && entries[initialId] != null ? initialId : null;
  const {
    openId,
    dialogRef,
    mediaRef,
    consumePresentationClose,
    show,
    swap,
    hide,
  } = useDetailPresentation(initial, clearPreviewNow);
  const shownRef = useRef<string | null>(initial);
  const wantRef = useRef<string | null>(initial);
  // The element the next opening grows out of, when a click asked for it.
  const fromRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);
  // The param as of the latest render, for code that runs after a morph.
  const requestedRef = useRef(requested);
  const pendingRef = useRef<PendingUrl | null>(null);
  // The current history entry is the one opening pushed, so closing can go
  // back to the page the visitor opened the view from.
  const ownEntryRef = useRef(false);

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
    if (named === shown || (named !== null && entries[named] == null)) return;
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
        await hide(shown);
        shownRef.current = null;
      } else if (entries[want] == null) {
        // A stale or mistyped link should not close a view the visitor is
        // reading, so an id with no entry keeps what is on screen.
        if (wantRef.current === want) wantRef.current = shown;
      } else if (shown === null) {
        const from = fromRef.current;
        fromRef.current = null;
        if (await show(want, from, () => wantRef.current === want))
          shownRef.current = want;
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

  const requestOpen = (id: string, from?: HTMLElement | null) => {
    wantRef.current = id;
    if (from !== undefined) fromRef.current = from;
    void settle();
  };
  const onNativeClose = () => {
    if (consumePresentationClose()) return;
    if (wantRef.current !== null) requestClose();
  };

  useEffect(() => {
    registerOpener(requestOpen);
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
    openId,
    dialogRef,
    mediaRef,
    requestOpen,
    requestClose,
    onNativeClose,
  };
}
