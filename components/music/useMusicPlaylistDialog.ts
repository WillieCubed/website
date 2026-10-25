'use client';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { type PlaylistMotionParts, playlistMotion } from '@/lib/music/motion';
import {
  Catalog,
  MusicMode,
  PlaylistView,
  gallerySelection,
} from '@/lib/music/presentation';

import { musicHref, useMusicPlaylistHistory } from './useMusicPlaylistHistory';

interface Options {
  catalog: Catalog;
  mode: MusicMode;
  initialDetail?: string;
  initialCatalog: Catalog;
  finishReordering: () => void;
  editing: boolean;
  playlists: PlaylistView[];
  displayed: string[];
  gallery: RefObject<HTMLDivElement | null>;
  seriesId: string | null;
  setSeriesId: (id: string | null) => void;
}
interface PlaylistDestination {
  seriesId: string | null;
  playlistIds: string[];
  related?: boolean;
}
export function useMusicPlaylistDialog({
  catalog,
  mode,
  initialDetail,
  initialCatalog,
  finishReordering,
  editing,
  playlists,
  displayed,
  gallery,
  seriesId,
  setSeriesId,
}: Options) {
  const [focused, setFocused] = useState<string | null>(
    initialDetail &&
      playlists.some((p) => p.id === initialDetail) &&
      initialCatalog.selected.includes(initialDetail)
      ? initialDetail
      : null
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelMotion = useRef<(() => void) | null>(null);
  const focusSequence = useRef<string[]>([]);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusIds =
    focused && focusSequence.current.length > 0
      ? focusSequence.current
      : displayed;
  const currentIndex = focused ? focusIds.indexOf(focused) : -1;
  useEffect(() => () => cancelMotion.current?.(), []);

  const playlistHistory = useMusicPlaylistHistory({
    catalog,
    editing,
    playlists,
    mode,
    onLocation: (series, detail, external) => {
      if (external) {
        cancelMotion.current?.();
        focusSequence.current = [];
      }
      setSeriesId(series);
      setFocused(detail);
      if (detail) upgradePlaylistDialog(dialog.current);
      else dialog.current?.close();
    },
  });

  function chooseSeries(id: string | null) {
    setSeriesId(id);
    finishReordering();
    history.pushState(null, '', musicHref(id, null, mode));
  }

  function openPlaylist(
    id: string,
    source: HTMLElement | null = null,
    destination?: PlaylistDestination
  ) {
    const target = destination ?? { seriesId, playlistIds: displayed };
    cancelMotion.current?.();
    const alreadyOpen = !!dialog.current?.open;
    if (!alreadyOpen) returnFocus.current = source;
    if (!alreadyOpen || destination)
      focusSequence.current = [...target.playlistIds];
    const before = alreadyOpen
      ? playlistFocusParts(dialog.current)
      : cardParts(source);
    cancelMotion.current = playlistMotion(
      () => {
        const focusedControl = document.activeElement;
        flushSync(() => {
          setFocused(id);
          setSeriesId(target.seriesId);
        });
        showPlaylistDialog(dialog.current);
        restoreNavigationFocus(dialog.current, focusedControl, alreadyOpen);
        const scroller = dialog.current?.querySelector<HTMLElement>(
          '.music-detail-scroll'
        );
        if (scroller) scroller.scrollTop = 0;
        if (target.related) {
          dialog.current
            ?.querySelector<HTMLElement>('#music-detail-title')
            ?.focus({ preventScroll: true });
          playlistHistory.openRelated(target.seriesId, id, alreadyOpen);
        } else playlistHistory.open(target.seriesId, id, alreadyOpen);
      },
      before,
      () => playlistFocusParts(dialog.current),
      alreadyOpen ? 'swap' : 'open'
    );
  }

  function closePlaylist() {
    cancelMotion.current?.();
    const { originVisible, target, visibleTarget } = closeTarget(
      returnFocus.current,
      gallery.current,
      focused
    );
    cancelMotion.current = playlistMotion(
      () => {
        dialog.current?.close();
        flushSync(() => setFocused(null));
        const restore = originVisible ? returnFocus.current : target;
        if (restore?.isConnected) restore.focus({ preventScroll: true });
        playlistHistory.close(seriesId);
      },
      visibleTarget ? playlistFocusParts(dialog.current) : {},
      () => cardParts(visibleTarget),
      'close'
    );
  }

  function openRelatedPlaylist(id: string) {
    openPlaylist(id, null, {
      seriesId: null,
      playlistIds: gallerySelection(catalog, mode, editing, null, 'all')
        .displayed,
      related: true,
    });
  }

  return {
    focused,
    focusIds,
    currentIndex,
    dialog,
    openPlaylist,
    openRelatedPlaylist,
    closePlaylist,
    chooseSeries,
    href: (series: string | null, detail: string | null) =>
      musicHref(series, detail, mode),
  };
}

function playlistFocusParts(
  dialog: HTMLDialogElement | null
): PlaylistMotionParts {
  const find = (selector: string) =>
    dialog?.querySelector<HTMLElement>(selector);
  const body = find('.music-detail-body');
  return {
    surface: dialog,
    viewport: find('.music-detail-scroll'),
    cover: find('[data-focus-cover]'),
    controls: find('.music-detail-bar'),
    summary:
      (body?.getBoundingClientRect().height ?? 0) > 0
        ? body
        : find('#music-detail-title'),
    tracks: find('.music-detail-tracks'),
    context: find('.music-detail-context'),
    editor: find('.music-context-editor'),
  };
}

function restoreNavigationFocus(
  dialog: HTMLDialogElement | null,
  focusedControl: Element | null,
  alreadyOpen: boolean
) {
  if (
    alreadyOpen &&
    focusedControl instanceof HTMLButtonElement &&
    focusedControl.disabled
  ) {
    dialog
      ?.querySelector<HTMLElement>(
        '.music-detail-pagination button:not(:disabled)'
      )
      ?.focus({ preventScroll: true });
  }
}
function closeTarget(
  origin: HTMLElement | null,
  gallery: HTMLDivElement | null,
  focused: string | null
) {
  const { originVisible, target } = playlistReturnTarget(
    origin,
    gallery,
    focused
  );
  const box = cardParts(target).cover?.getBoundingClientRect();
  const visibleTarget =
    box && box.bottom > 0 && box.top < innerHeight ? target : null;
  return { originVisible, target, visibleTarget };
}
function upgradePlaylistDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.matches(':modal')) return;
  const { scroller, readingPosition, readingFocus } =
    playlistReadingContext(dialog);
  if (dialog.open) dialog.close();
  dialog.showModal();
  (
    readingFocus ?? dialog.querySelector<HTMLElement>('#music-detail-title')
  )?.focus({ preventScroll: true });
  if (scroller) scroller.scrollTop = readingPosition;
}

function playlistReadingContext(dialog: HTMLDialogElement) {
  const scroller = dialog.querySelector<HTMLElement>('.music-detail-scroll');
  const readingPosition = scroller?.scrollTop ?? 0;
  const active = document.activeElement;
  const readingFocus =
    active instanceof HTMLElement && dialog.contains(active)
      ? active
      : readingPosition > 0
        ? scroller
        : null;
  return { scroller, readingPosition, readingFocus };
}

function showPlaylistDialog(dialog: HTMLDialogElement | null) {
  if (dialog?.open) return;
  dialog?.showModal();
  dialog
    ?.querySelector<HTMLElement>('#music-detail-title')
    ?.focus({ preventScroll: true });
}

function cardParts(source?: HTMLElement | null): PlaylistMotionParts {
  const card = source?.querySelector('[data-card-cover]')
    ? source
    : (source?.closest<HTMLElement>('.music-card') ?? source);
  return {
    surface: card?.querySelector<HTMLElement>('[data-card-surface]'),
    cover: card?.querySelector<HTMLElement>('[data-card-cover]'),
  };
}

function playlistReturnTarget(
  origin: HTMLElement | null,
  gallery: HTMLDivElement | null,
  focused: string | null
) {
  const originId =
    origin?.dataset.playlistOrigin ??
    origin?.closest<HTMLElement>('.music-card')?.dataset.playlist;
  const originVisible =
    origin?.isConnected && origin.getClientRects().length > 0;
  const target =
    originVisible && originId === focused
      ? origin
      : gallery?.querySelector<HTMLElement>(
          `[data-playlist="${focused}"] .music-card-open`
        );
  return { originVisible, target };
}
