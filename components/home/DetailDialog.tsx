'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { type Detail, type DetailMedia, entries } from '@/lib/home/ventures';

import { Constellation } from './Constellation';
import { brandStyle, prefersReducedMotion, useHome } from './HomeContext';
import { Icon } from './Icon';

interface Source {
  /** The entry the source stands for, which a swap can leave behind. */
  id: string;
  card: HTMLElement;
  media: HTMLElement | null;
}

const setName = (el: HTMLElement | null, value: string) => {
  if (el) el.style.viewTransitionName = value;
};

// Every DOM change happens inside the transition callback so the browser can
// morph the old and new snapshots. Without the API, or under reduced motion,
// the change just applies. A transition the browser abandons, such as one
// started in a background tab, still runs the update, so its rejection is
// swallowed rather than left to strand the dialog mid-open.
//
// `kind` sits on the root while the morph runs, so home.css can give the
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
function Media({
  id,
  media,
  countdown,
}: {
  id: string;
  media: DetailMedia;
  countdown: React.ReactNode;
}) {
  switch (media.kind) {
    case 'countdown':
      return (
        <div className="d-count">
          <b data-morph={id}>{countdown}</b>
          <span>{media.caption}</span>
        </div>
      );
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.src}
          width={media.width}
          height={media.height}
          alt={media.alt}
          className={media.fromLeft ? 'from-left' : undefined}
          data-morph={id}
        />
      );
    case 'stack':
      return (
        <div className="d-stack">
          {media.images.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image.src}
              src={image.src}
              width={image.width}
              height={image.height}
              alt={image.alt}
            />
          ))}
        </div>
      );
    case 'constellation':
      return <Constellation morph={id} />;
  }
}

function Body({
  detail,
  onOpen,
}: {
  detail: Detail;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="d-body">
      {detail.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {detail.list && (
        <ul className="d-list">
          {detail.list.map((item) => (
            <li key={item.title}>
              {item.opens ? (
                <button type="button" onClick={() => onOpen(item.opens!)}>
                  <b>
                    {item.title}
                    <Icon name="forward" />
                  </b>
                  <span>{item.text}</span>
                </button>
              ) : (
                <>
                  <b>{item.title}</b>
                  <span>{item.text}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="d-links">
        {detail.links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
            <Icon name="outward" />
          </a>
        ))}
      </div>
    </div>
  );
}

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

/**
 * The detail view. What it shows and the `?detail=<id>` search param mirror
 * each other, so the back gesture, the close button, and a shared link all
 * land in the same state.
 *
 * The visitor's own actions change the dialog first and the URL after: a
 * click opens it and then pushes an entry, and a close closes it and drops
 * the param at once. Any other change to the param, such as Back, Forward,
 * or a command run from the command palette, is answered by opening,
 * swapping, or closing to match. Either way the request lands in `wantRef`,
 * and `settle` morphs toward it one step at a time, so a request made
 * mid-morph waits for the morph instead of being lost.
 */
export function DetailDialog({ registerOpener, countdown }: DetailDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get('detail');

  const { brands, clearPreviewNow } = useHome();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const shownRef = useRef<string | null>(null);
  const wantRef = useRef<string | null>(null);
  // The element the next opening grows out of, when a click asked for it.
  const fromRef = useRef<HTMLElement | null>(null);
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
      if (!dialog.open) dialog.showModal();
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

  const entry = openId ? entries[openId] : null;
  const style = brandStyle(brands, entry?.brand);
  const media = entry?.detail.media;

  return (
    <dialog
      ref={dialogRef}
      className="detail"
      aria-labelledby="d-title"
      data-brand={entry?.brand}
      data-branded={entry && style ? '' : undefined}
      style={style}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      // The browser can close the dialog without a cancel to intercept, such
      // as on a second Escape in a row. Close the view with it.
      onClose={() => {
        if (selfClosedRef.current) {
          selfClosedRef.current = false;
          return;
        }
        if (wantRef.current !== null) requestClose();
      }}
      {...backdrop}
    >
      <div className="d-bar">
        <button
          className="d-close"
          type="button"
          aria-label="Close"
          onClick={requestClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="d-inner" key={openId ?? 'empty'}>
        <div
          className={
            media?.kind === 'image' && media.framed
              ? 'd-media framed'
              : 'd-media'
          }
          ref={mediaRef}
        >
          {media && openId && (
            <Media id={openId} media={media} countdown={countdown} />
          )}
        </div>
        <div className="d-content">
          <span className="d-kicker">{entry?.parent ?? ''}</span>
          <h2 className="d-title" id="d-title">
            {entry?.name}
          </h2>
          {entry && (
            <Body
              detail={entry.detail}
              onOpen={(id) => {
                wantRef.current = id;
                void settle();
              }}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}
