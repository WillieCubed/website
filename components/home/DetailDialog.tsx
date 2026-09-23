'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { type Detail, type DetailMedia, entries } from '@/lib/home/ventures';

import { Constellation } from './Constellation';
import { brandStyle, prefersReducedMotion, useHome } from './HomeContext';
import { Icon } from './Icon';

interface Source {
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
const morph = (update: () => void): Promise<void> => {
  if (!document.startViewTransition || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => undefined);
};

// The shared element is whatever the visitor actually touched: a product
// card, a tile, or a list row's front preview card.
function sourceFor(id: string, from: HTMLElement | null): Source | null {
  if (from?.classList.contains('product')) {
    return { card: from, media: from.querySelector('.p-media') };
  }
  const row = from?.closest<HTMLElement>('.index a');
  if (row)
    return { card: row, media: row.querySelector('.stack i:last-child') };
  const tile =
    document.getElementById(id) ?? document.getElementById('hypertext');
  return tile
    ? { card: tile, media: tile.querySelector('[data-media]') }
    : null;
}

// The detail view's pictures are never lazy: the morph snapshots the dialog
// as soon as it opens, and the tile or row it grew from has usually loaded
// the same file already.
function Media({
  media,
  countdown,
}: {
  media: DetailMedia;
  countdown: React.ReactNode;
}) {
  switch (media.kind) {
    case 'countdown':
      return (
        <div className="d-count">
          <b>{countdown}</b>
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
      return <Constellation />;
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

/**
 * Identifies the current history entry. Next keeps a key on the state it
 * writes; a fresh entry gets a fresh key, so comparing it says whether the
 * entry that opening pushed is still the one on top.
 */
function historyKey(): unknown {
  if (typeof window === 'undefined') return null;
  const state = window.history.state as { key?: unknown } | null;
  return state?.key ?? null;
}

/**
 * The detail view. The `?detail=<id>` search param is the source of truth
 * for which entry is open, so the back gesture, the close button, and a
 * shared link all land in the same state. Opening from a click morphs first
 * and then pushes the URL; every other change to the param is answered by
 * opening or closing to match.
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
  const openIdRef = useRef<string | null>(null);
  const sourceRef = useRef<Source | null>(null);
  // The history entry opening pushed, so closing can go back instead of
  // replacing a URL the visitor arrived on — and only when that entry is
  // still the current one.
  const pushedRef = useRef<unknown>(null);
  const busyRef = useRef(false);

  const open = async (id: string, from: HTMLElement | null, push: boolean) => {
    if (openIdRef.current || busyRef.current || !entries[id]) return;
    const source = sourceFor(id, from);
    if (!source) return;
    busyRef.current = true;
    flushSync(() => clearPreviewNow());
    setName(source.card, 'card');
    setName(source.media, 'media');
    sourceRef.current = source;
    openIdRef.current = id;
    await morph(() => {
      setName(source.card, '');
      setName(source.media, '');
      source.card.style.visibility = 'hidden';
      flushSync(() => setOpenId(id));
      const dialog = dialogRef.current;
      if (!dialog) return;
      setName(dialog, 'card');
      setName(mediaRef.current, 'media');
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
    });
    // The URL changes after the morph. Pushing first made the router start
    // its own view transition and the morph aborted with an invalid state.
    if (push) {
      router.push(`${pathname}?detail=${id}`, { scroll: false });
      pushedRef.current = historyKey();
    }
    busyRef.current = false;
  };

  // Moving from the studio to one of its products keeps the dialog in place
  // and crossfades its contents, so it reads as going deeper.
  const swap = async (id: string, replace: boolean) => {
    if (!entries[id] || busyRef.current) return;
    busyRef.current = true;
    openIdRef.current = id;
    await morph(() => {
      flushSync(() => setOpenId(id));
      if (dialogRef.current) dialogRef.current.scrollTop = 0;
    });
    if (replace) router.replace(`${pathname}?detail=${id}`, { scroll: false });
    busyRef.current = false;
  };

  const close = async () => {
    const source = sourceRef.current;
    const dialog = dialogRef.current;
    if (!openIdRef.current || busyRef.current || !dialog) return;
    busyRef.current = true;
    openIdRef.current = null;
    pushedRef.current = null;
    await morph(() => {
      setName(dialog, '');
      setName(mediaRef.current, '');
      dialog.close();
      if (source) {
        source.card.style.visibility = '';
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
    busyRef.current = false;
  };

  // Closing goes through history so the back gesture and the close button
  // behave the same way.
  const requestClose = () => {
    const pushed = pushedRef.current;
    // Going back is only safe while the entry opening pushed is still on
    // top. Otherwise closing drops the param where it stands, so it can
    // never send the visitor past the page they came from.
    if (pushed !== null && pushed === historyKey()) router.back();
    else router.replace(pathname, { scroll: false });
  };

  useEffect(() => {
    registerOpener((id, from) => {
      void open(id, from, true);
    });
  });

  useEffect(() => {
    const current = openIdRef.current;
    if (requested && requested !== current) {
      if (current) void swap(requested, false);
      else void document.fonts.ready.then(() => open(requested, null, false));
    } else if (!requested && current) {
      void close();
    }
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
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
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
          {media && <Media media={media} countdown={countdown} />}
        </div>
        <div className="d-content">
          <span className="d-kicker">{entry?.parent ?? ''}</span>
          <h2 className="d-title" id="d-title">
            {entry?.name}
          </h2>
          {entry && (
            <Body detail={entry.detail} onOpen={(id) => void swap(id, true)} />
          )}
        </div>
      </div>
    </dialog>
  );
}
