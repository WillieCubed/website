'use client';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { type PlaylistMotionParts, playlistMotion } from '@/lib/music/motion';
import type {
  Catalog,
  MusicMode,
  PlaylistView,
} from '@/lib/music/presentation';

function readLocation() {
  const params = new URLSearchParams(location.search);
  return { series: params.get('series'), detail: params.get('detail') };
}

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
  const ownDetailEntry = useRef(false);
  const ownPop = useRef(false);
  const focusIds =
    focused && focusSequence.current.length > 0
      ? focusSequence.current
      : displayed;
  const currentIndex = focused ? focusIds.indexOf(focused) : -1;
  useEffect(() => () => cancelMotion.current?.(), []);

  useEffect(() => {
    const sync = (external = false) => {
      if (external) focusSequence.current = [];
      const state = readLocation();
      setSeriesId(
        catalog.series.some((item) => item.id === state.series)
          ? state.series
          : null
      );
      const allowed =
        playlists.some((item) => item.id === state.detail) &&
        (editing || catalog.selected.includes(state.detail!));
      setFocused(allowed ? state.detail : null);
      if (external) ownDetailEntry.current = false;
      if (allowed) upgradePlaylistDialog(dialog.current);
      else dialog.current?.close();
    };
    sync();
    const pop = () => {
      if (ownPop.current) {
        ownPop.current = false;
        return;
      }
      cancelMotion.current?.();
      sync(true);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [catalog, editing]);

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
    const before = alreadyOpen ? focusParts() : cardParts(source);
    cancelMotion.current = playlistMotion(
      () => {
        const focusedControl = document.activeElement;
        flushSync(() => setFocused(id));
        showPlaylistDialog(dialog.current);
        if (
          alreadyOpen &&
          focusedControl instanceof HTMLButtonElement &&
          focusedControl.disabled
        ) {
          dialog.current
            ?.querySelector<HTMLElement>(
              '.mp-detail-pagination button:not(:disabled)'
            )
            ?.focus({ preventScroll: true });
        }
        const scroller =
          dialog.current?.querySelector<HTMLElement>('.mp-detail-scroll');
        if (scroller) scroller.scrollTop = 0;
        if (alreadyOpen)
          history.replaceState(null, '', musicHref(target.seriesId, id, mode));
        else {
          history.pushState(null, '', musicHref(target.seriesId, id, mode));
          ownDetailEntry.current = true;
        }
      },
      before,
      focusParts,
      alreadyOpen ? 'swap' : 'open'
    );
  }

  function focusParts(): PlaylistMotionParts {
    const find = (selector: string) =>
      dialog.current?.querySelector<HTMLElement>(selector);
    return {
      surface: dialog.current,
      cover: find('[data-focus-cover]'),
      controls: find('.mp-detail-bar'),
      summary: find('.mp-detail-body'),
      tracks: find('.mp-detail-tracks'),
      context: find('.mp-detail-context'),
      editor: find('.mp-context-editor'),
    };
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
        if (ownDetailEntry.current) {
          ownPop.current = true;
          history.back();
        } else history.replaceState(null, '', musicHref(seriesId, null, mode));
        ownDetailEntry.current = false;
      },
      visibleTarget ? focusParts() : {},
      () => cardParts(visibleTarget),
      'close'
    );
  }

  const backdrop = useBackdropDismiss(closePlaylist);

  return {
    focused,
    focusIds,
    currentIndex,
    dialog,
    openPlaylist,
    closePlaylist,
    backdrop,
    chooseSeries,
    href: (series: string | null, detail: string | null) =>
      musicHref(series, detail, mode),
  };
}

export function musicHref(
  nextSeries: string | null,
  detail: string | null,
  mode: MusicMode
) {
  const params = new URLSearchParams();
  if (nextSeries) params.set('series', nextSeries);
  if (detail) params.set('detail', detail);
  const path =
    mode === 'prototype'
      ? '/prototypes/music'
      : mode === 'admin'
        ? '/studio/music'
        : '/music';
  return `${path}${params.size > 0 ? `?${params}` : ''}`;
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
  if (dialog.open) dialog.close();
  dialog.showModal();
  dialog
    .querySelector<HTMLElement>('#mp-detail-title')
    ?.focus({ preventScroll: true });
}

function showPlaylistDialog(dialog: HTMLDialogElement | null) {
  if (dialog?.open) return;
  dialog?.showModal();
  dialog
    ?.querySelector<HTMLElement>('#mp-detail-title')
    ?.focus({ preventScroll: true });
}

function cardParts(source?: HTMLElement | null): PlaylistMotionParts {
  const card = source?.querySelector('[data-card-cover]')
    ? source
    : (source?.closest<HTMLElement>('.mp-card') ?? source);
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
    origin?.closest<HTMLElement>('.mp-card')?.dataset.playlist;
  const originVisible =
    origin?.isConnected && origin.getClientRects().length > 0;
  const target =
    originVisible && originId === focused
      ? origin
      : gallery?.querySelector<HTMLElement>(
          `[data-playlist="${focused}"] .mp-card-open`
        );
  return { originVisible, target };
}
