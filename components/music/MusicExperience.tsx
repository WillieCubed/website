'use client';

import { type ComponentType, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';
import { usePalette } from '@/components/palette/PaletteProvider';
import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';
import TopBar from '@/components/site/TopBar';
import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { type PlaylistMotionParts, playlistMotion } from '@/lib/music/motion';
import {
  type Catalog,
  type PlaylistView,
  listeningTime,
  moveItem,
} from '@/lib/music/presentation';

import MusicCover from './MusicCover';
import MusicScrollCue from './MusicScrollCue';
import MusicSelectionControl from './MusicSelectionControl';
import MusicSetup from './MusicSetup';
import './music-prototype.css';

const STORAGE_KEY = 'willie-music-prototype-v1';

function readLocation() {
  const params = new URLSearchParams(location.search);
  return { series: params.get('series'), detail: params.get('detail') };
}

export interface MusicExperienceProps {
  playlists: PlaylistView[];
  initialCatalog: Catalog;
  mode?: 'prototype' | 'admin' | 'public';
  validCatalog?: (value: unknown) => value is Catalog;
  Cover?: ComponentType<{ playlist: PlaylistView }>;
  onChange?: (catalog: Catalog) => void;
  onPublish?: (reviewed: Catalog) => Promise<void>;
  saveStatus?: string;
  canReview?: boolean;
  interactionLocked?: boolean;
  connected?: boolean;
  onConnect?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  adminMenuItems?: BreadcrumbMenuItem[];
  setupInitially?: boolean;
}
export default function MusicExperience({
  playlists,
  initialCatalog,
  mode = 'public',
  validCatalog,
  Cover = MusicCover,
  onChange,
  onPublish,
  saveStatus,
  canReview = true,
  interactionLocked = false,
  connected = false,
  onConnect,
  onRefresh,
  adminMenuItems = [],
  setupInitially = false,
}: MusicExperienceProps) {
  const [live, setLive] = useState<Catalog>(initialCatalog);
  const [draft, setDraft] = useState<Catalog>(initialCatalog);
  const [editing, setEditing] = useState(mode === 'admin');
  const [setup, setSetup] = useState(setupInitially);
  const [review, setReview] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const { close: closePalette, registerCommands } = usePalette();
  const [libraryFilter, setLibraryFilter] = useState<
    'all' | 'selected' | 'unselected'
  >('all');
  const [newSeries, setNewSeries] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const cancelMotion = useRef<(() => void) | null>(null);
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const curateToggle = useRef<HTMLButtonElement>(null);
  const setupToggle = useRef<HTMLButtonElement>(null);
  const focusSequence = useRef<string[]>([]);
  const returnFocus = useRef<HTMLElement | null>(null);
  const ownDetailEntry = useRef(false);
  const ownPop = useRef(false);
  const dragId = useRef<string | null>(null);
  const catalog = editing || mode === 'admin' ? draft : live;
  const series = catalog.series.find((item) => item.id === seriesId);
  const order = series?.playlistIds ?? catalog.order;
  const visibleIds = order.filter(
    (id) => editing || catalog.selected.includes(id)
  );
  const matching = visibleIds.filter(
    (id) =>
      !editing ||
      libraryFilter === 'all' ||
      catalog.selected.includes(id) === (libraryFilter === 'selected')
  );
  const lead =
    !series && !editing && catalog.lead && matching.includes(catalog.lead)
      ? catalog.lead
      : null;
  const displayed = lead
    ? [lead, ...matching.filter((id) => id !== lead)]
    : matching;
  const current = playlists.find((item) => item.id === focused);
  const sampleTracks = current?.tracks ?? [];
  const runtime = listeningTime(sampleTracks);
  const focusIds =
    focused && focusSequence.current.length ? focusSequence.current : displayed;
  const currentIndex = focused ? focusIds.indexOf(focused) : -1;
  const changed = JSON.stringify(live) !== JSON.stringify(draft);

  useEffect(() => () => cancelMotion.current?.(), []);

  useEffect(() => {
    if (mode !== 'prototype') {
      setReady(true);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && validCatalog?.(saved.live) && validCatalog?.(saved.draft)) {
        setLive(saved.live);
        setDraft(saved.draft);
      }
    } catch {
      setStorageError(
        'The local draft could not be restored. This session uses the sample collection.'
      );
    }
    setReady(true);
    setSetup(new URLSearchParams(location.search).has('setup'));
  }, []);

  useEffect(() => {
    if (!ready || mode !== 'prototype') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ live, draft }));
    } catch {
      setStorageError(
        'Browser storage is unavailable. Keep this tab open to retain your changes.'
      );
    }
  }, [live, draft, ready]);

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
      if (allowed && !dialog.current?.open) {
        dialog.current?.showModal();
        dialog.current
          ?.querySelector<HTMLElement>('#mp-detail-title')
          ?.focus({ preventScroll: true });
      } else if (!allowed) dialog.current?.close();
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

  useEffect(() => {
    if (review && !reviewDialog.current?.open) {
      reviewDialog.current?.showModal();
      reviewDialog.current
        ?.querySelector<HTMLElement>('#mp-review-title')
        ?.focus({ preventScroll: true });
      if (reviewDialog.current) reviewDialog.current.scrollTop = 0;
    }
  }, [review]);

  function href(nextSeries: string | null, detail: string | null) {
    const params = new URLSearchParams();
    if (nextSeries) params.set('series', nextSeries);
    if (detail) params.set('detail', detail);
    return `${location.pathname}${params.size ? `?${params}` : ''}`;
  }

  function chooseSeries(id: string | null) {
    setSeriesId(id);
    history.pushState(null, '', href(id, null));
  }

  function openPlaylist(id: string, source?: HTMLElement) {
    cancelMotion.current?.();
    if (source) returnFocus.current = source;
    const alreadyOpen = !!dialog.current?.open;
    if (!alreadyOpen) focusSequence.current = [...displayed];
    const before = alreadyOpen ? focusParts() : cardParts(source);
    cancelMotion.current = playlistMotion(
      () => {
        const focusedControl = document.activeElement;
        flushSync(() => setFocused(id));
        if (!dialog.current?.open) {
          dialog.current?.showModal();
          dialog.current
            ?.querySelector<HTMLElement>('#mp-detail-title')
            ?.focus({ preventScroll: true });
        }
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
        if (alreadyOpen) history.replaceState(null, '', href(seriesId, id));
        else {
          history.pushState(null, '', href(seriesId, id));
          ownDetailEntry.current = true;
        }
      },
      before,
      focusParts,
      alreadyOpen ? 'swap' : 'open'
    );
  }

  useEffect(() => {
    if (setup) return;
    const ids = catalog.order.filter(
      (id) => editing || catalog.selected.includes(id)
    );
    return registerCommands(
      ids.flatMap((id) => {
        const playlist = playlists.find((item) => item.id === id);
        if (!playlist) return [];
        return [
          {
            id: `music:open:${id}`,
            title: playlist.title,
            detail: 'Open playlist',
            group: 'Playlists' as const,
            keywords: ['music', 'playlist'],
            kind: 'music' as const,
            run: async () => {
              await closePalette({ animate: false, restoreFocus: false });
              if (!displayed.includes(id)) {
                flushSync(() => {
                  setSeriesId(null);
                  setLibraryFilter('all');
                });
                history.pushState(null, '', href(null, null));
              }
              const card = [
                ...document.querySelectorAll<HTMLElement>('.mp-card'),
              ].find((item) => item.dataset.playlist === id);
              card?.scrollIntoView({ behavior: 'instant', block: 'center' });
              card?.querySelector<HTMLButtonElement>('.mp-card-open')?.click();
            },
          },
        ];
      })
    );
  }, [
    setup,
    catalog,
    editing,
    playlists,
    displayed.join(','),
    registerCommands,
    closePalette,
  ]);

  function cardParts(source?: HTMLElement | null): PlaylistMotionParts {
    const card = source?.querySelector('[data-card-cover]')
      ? source
      : (source?.closest<HTMLElement>('.mp-card') ?? source);
    return {
      surface: card?.querySelector<HTMLElement>('[data-card-surface]'),
      cover: card?.querySelector<HTMLElement>('[data-card-cover]'),
    };
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
    const originId =
      returnFocus.current?.dataset.playlistOrigin ??
      returnFocus.current?.closest<HTMLElement>('.mp-card')?.dataset.playlist;
    const originVisible =
      returnFocus.current?.isConnected &&
      returnFocus.current.getClientRects().length > 0;
    const target =
      originVisible && originId === focused
        ? returnFocus.current
        : gallery.current?.querySelector<HTMLElement>(
            `[data-playlist="${focused}"] .mp-card-open`
          );
    const box = cardParts(target).cover?.getBoundingClientRect();
    const visibleTarget =
      box && box.bottom > 0 && box.top < innerHeight ? target : null;
    cancelMotion.current = playlistMotion(
      () => {
        dialog.current?.close();
        flushSync(() => setFocused(null));
        const restore = originVisible ? returnFocus.current : target;
        if (restore?.isConnected) restore.focus({ preventScroll: true });
        if (ownDetailEntry.current) {
          ownPop.current = true;
          history.back();
        } else history.replaceState(null, '', href(seriesId, null));
        ownDetailEntry.current = false;
      },
      visibleTarget ? focusParts() : {},
      () => cardParts(visibleTarget),
      'close'
    );
  }

  const backdrop = useBackdropDismiss(closePlaylist);

  function change(next: Catalog) {
    onChange?.(next);
    setDraft(next);
    setAnnouncement('Draft saved in this browser.');
  }

  function closeReview() {
    flushSync(() => setReview(false));
    reviewTrigger.current?.focus({ preventScroll: true });
  }

  function select(id: string) {
    const selected = draft.selected.includes(id)
      ? draft.selected.filter((item) => item !== id)
      : [...draft.selected, id];
    change({
      ...draft,
      selected,
      lead: selected.includes(draft.lead ?? '') ? draft.lead : null,
    });
  }

  function reorder(id: string, step: number) {
    if (series)
      change({
        ...draft,
        series: draft.series.map((item) =>
          item.id === series.id
            ? { ...item, playlistIds: moveItem(item.playlistIds, id, step) }
            : item
        ),
      });
    else change({ ...draft, order: moveItem(draft.order, id, step) });
    setAnnouncement(
      `${playlists.find((item) => item.id === id)?.title} moved ${step < 0 ? 'earlier' : 'later'}.`
    );
  }

  function dropOn(id: string) {
    if (!editing || libraryFilter !== 'all') return;
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === id) return;
    const next = [...order];
    next.splice(next.indexOf(from), 1);
    next.splice(next.indexOf(id), 0, from);
    if (series)
      change({
        ...draft,
        series: draft.series.map((item) =>
          item.id === series.id ? { ...item, playlistIds: next } : item
        ),
      });
    else change({ ...draft, order: next });
  }

  function addSeries(event: React.FormEvent) {
    event.preventDefault();
    const title = newSeries?.trim();
    if (!title) return;
    const id = `series-${crypto.randomUUID()}`;
    change({
      ...draft,
      series: [...draft.series, { id, title, playlistIds: [] }],
    });
    setNewSeries(null);
    chooseSeries(id);
  }

  function membership(id: string, member: string) {
    change({
      ...draft,
      series: draft.series.map((item) =>
        item.id !== id
          ? item
          : {
              ...item,
              playlistIds: item.playlistIds.includes(member)
                ? item.playlistIds.filter((value) => value !== member)
                : [...item.playlistIds, member],
            }
      ),
    });
  }

  function renderCard(playlist: PlaylistView, index: number) {
    const sampleTracks = playlist.tracks;
    const runtime = listeningTime(sampleTracks);
    const selected = catalog.selected.includes(playlist.id);
    const featured = playlist.id === lead;
    const note = catalog.notes[playlist.id]?.trim();
    const memberships = featured
      ? catalog.series
          .map((item) => ({
            ...item,
            playlistIds: item.playlistIds.filter((id) =>
              catalog.selected.includes(id)
            ),
          }))
          .filter((item) => item.playlistIds.includes(playlist.id))
      : [];
    return (
      <article
        key={playlist.id}
        className={`mp-card${featured ? ' mp-card-lead' : ''}${editing && !selected ? ' mp-card-unselected' : ''}`}
        aria-label={featured ? 'Featured playlist' : undefined}
        data-playlist={playlist.id}
        data-focused={playlist.id === focused || undefined}
        draggable={editing && libraryFilter === 'all'}
        onDragStart={() => {
          dragId.current = playlist.id;
        }}
        onDragOver={(event) => {
          if (editing && libraryFilter === 'all') event.preventDefault();
        }}
        onDrop={() => dropOn(playlist.id)}
      >
        <button
          className="mp-card-open"
          onClick={(event) => openPlaylist(playlist.id, event.currentTarget)}
          aria-label={`Open ${playlist.title}`}
        >
          <div className="mp-art-frame" data-card-surface="">
            <div
              className="mp-art"
              data-card-cover=""
              style={{ background: playlist.color }}
            >
              <Cover playlist={playlist} />
            </div>
          </div>
          {!featured && (
            <div className="mp-card-caption">
              <div>
                <h3>{playlist.title}</h3>
                <p className="mp-small">
                  {series ? `${index + 1} of ${matching.length} · ` : ''}
                  {sampleTracks.length} tracks
                </p>
              </div>
              <span className="mp-open-icon">
                <Icon name="arrow-right" size={20} />
              </span>
            </div>
          )}
        </button>
        {featured && (
          <div className="mp-feature-details">
            <div className="mp-card-caption">
              <h3>{playlist.title}</h3>
            </div>
            <p className="mp-small mp-feature-meta">
              {sampleTracks.length} tracks
              {runtime && ` · ${runtime}`}
            </p>
            {note ? (
              <p className="mp-card-note">{note}</p>
            ) : (
              <ol className="mp-feature-tracks" aria-label="Opening tracks">
                {sampleTracks.slice(0, 3).map((track, index) => (
                  <li
                    key={index}
                    className={
                      track.unavailable ? 'mp-track-unavailable' : undefined
                    }
                  >
                    <span className="mp-feature-track-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="mp-feature-track-info">
                      <span>{track.title}</span>
                      <span>{track.artist}</span>
                    </span>
                    <span className="mp-feature-track-duration">
                      {track.duration}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {memberships.map((item) => (
              <div className="mp-feature-series" key={item.id}>
                <p className="mp-feature-series-context">
                  <span>{item.title}</span>
                  <span>
                    Part {item.playlistIds.indexOf(playlist.id) + 1} of{' '}
                    {item.playlistIds.length}
                  </span>
                </p>
                <div
                  className="mp-feature-series-covers"
                  role="group"
                  aria-label={`Other playlists in ${item.title}`}
                >
                  {item.playlistIds
                    .filter((id) => id !== playlist.id)
                    .slice(0, 2)
                    .map((id) => {
                      const related = playlists.find(
                        (candidate) => candidate.id === id
                      )!;
                      return (
                        <button
                          className="mp-series-cover"
                          key={id}
                          data-playlist-origin={id}
                          aria-label={`Open ${related.title} from ${item.title}`}
                          title={related.title}
                          onClick={(event) =>
                            openPlaylist(id, event.currentTarget)
                          }
                        >
                          <span
                            className="mp-series-cover-frame"
                            data-card-surface=""
                          >
                            <span data-card-cover="">
                              <Cover playlist={related} />
                            </span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
            <button
              className="mp-button mp-tonal mp-feature-action"
              onClick={(event) =>
                openPlaylist(playlist.id, event.currentTarget)
              }
            >
              Open playlist
            </button>
          </div>
        )}
        {editing && (
          <div className="mp-card-controls">
            <label className="mp-check">
              <MusicSelectionControl
                checked={selected}
                disabled={!playlist.eligible && !selected}
                onChange={() => select(playlist.id)}
                aria-label={`Include ${playlist.title}`}
              />
              {!playlist.eligible
                ? 'Unavailable for publication'
                : selected
                  ? 'Included'
                  : 'Include'}
            </label>
            <div className="mp-order-buttons">
              <span className="mp-order-label">Order</span>
              <button
                className="mp-icon-button"
                disabled={index === 0 || libraryFilter !== 'all'}
                onClick={() => reorder(playlist.id, -1)}
                aria-label={`Move ${playlist.title} earlier`}
              >
                <Icon name="arrow-left" />
              </button>
              <button
                className="mp-icon-button"
                disabled={
                  index === matching.length - 1 || libraryFilter !== 'all'
                }
                onClick={() => reorder(playlist.id, 1)}
                aria-label={`Move ${playlist.title} later`}
              >
                <Icon name="arrow-right" />
              </button>
            </div>
          </div>
        )}
      </article>
    );
  }

  function exitSetup(next?: Catalog) {
    const url = new URL(location.href);
    url.searchParams.delete('setup');
    history.replaceState(null, '', url);
    flushSync(() => {
      if (next) {
        setDraft(next);
        onChange?.(next);
        setEditing(true);
        setSeriesId(null);
        setLibraryFilter('all');
      }
      setSetup(false);
    });
    if (next) curateToggle.current?.focus({ preventScroll: true });
    else setupToggle.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (setup) {
    return (
      <div
        className="music-prototype"
        aria-busy={!ready || interactionLocked}
        aria-disabled={interactionLocked || undefined}
        inert={interactionLocked}
      >
        <MusicSetup
          playlists={
            mode === 'admin' ? playlists.filter((p) => p.eligible) : playlists
          }
          Cover={Cover}
          mode={mode}
          connected={connected}
          onConnect={onConnect}
          catalog={draft}
          onCancel={() => exitSetup()}
          onComplete={exitSetup}
        />
      </div>
    );
  }

  return (
    <div
      className="music-prototype"
      data-editing={editing || undefined}
      aria-busy={!ready || interactionLocked}
      aria-disabled={interactionLocked || undefined}
      inert={interactionLocked}
    >
      {mode === 'prototype' && (
        <div className="mp-prototype-bar">
          <span>
            {mode === 'prototype' ? (
              <>
                Local prototype
                <span className="mp-prototype-sample-label">
                  {' '}
                  · Sample content
                </span>
              </>
            ) : (
              <>{saveStatus ?? 'Private music collection'}</>
            )}
          </span>
          <div className="mp-prototype-actions">
            {onRefresh && (
              <button
                className="mp-text-button"
                onClick={() => void onRefresh()}
              >
                Refresh Spotify
              </button>
            )}
            <button
              ref={setupToggle}
              className="mp-text-button"
              onClick={() => {
                const url = new URL(location.href);
                url.search = '?setup';
                history.replaceState(null, '', url);
                setSetup(true);
                setReview(false);
              }}
            >
              Show setup
            </button>
            <button
              ref={curateToggle}
              className="mp-text-button"
              onClick={() => {
                setEditing(!editing);
                setReview(false);
                setLibraryFilter('all');
              }}
            >
              {editing ? 'View gallery' : 'Curate music'}
              <Icon name={editing ? 'arrow-right' : 'file'} />
            </button>
          </div>
        </div>
      )}
      <TopBar
        column="wide"
        crumbs={[
          {
            label: 'Music',
            menuItems:
              mode === 'admin'
                ? [
                    {
                      label: editing ? 'View gallery' : 'Curate music',
                      onSelect: () => {
                        setEditing(!editing);
                        setReview(false);
                        setLibraryFilter('all');
                      },
                    },
                    {
                      label: 'Choose playlists',
                      onSelect: () => {
                        setSetup(true);
                        setReview(false);
                      },
                    },
                    ...(onRefresh
                      ? [
                          {
                            label: 'Refresh Spotify',
                            onSelect: () => void onRefresh(),
                          },
                        ]
                      : []),
                    ...adminMenuItems,
                    { label: 'Studio', href: '/studio' },
                    {
                      label: 'Live music page',
                      href: 'https://willie.page/music',
                    },
                  ]
                : undefined,
            href:
              mode === 'prototype'
                ? '/prototypes/music'
                : mode === 'admin'
                  ? '/studio/music'
                  : '/music',
          },
        ]}
      />
      <main id="main" className="mp-shell">
        <aside className="mp-rail">
          <div className="mp-heading">
            <h1>Music</h1>
          </div>
          <nav className="mp-series-nav" aria-label="Playlist series">
            <button aria-pressed={!series} onClick={() => chooseSeries(null)}>
              <span>All playlists</span>
              <span>
                {editing ? playlists.length : catalog.selected.length}
              </span>
            </button>
            {catalog.series.map((item) => (
              <button
                key={item.id}
                aria-pressed={series?.id === item.id}
                onClick={() => chooseSeries(item.id)}
              >
                <span>{item.title}</span>
                <span>
                  {
                    item.playlistIds.filter(
                      (id) => editing || catalog.selected.includes(id)
                    ).length
                  }
                </span>
              </button>
            ))}
            {editing && (
              <button
                className="mp-new-series"
                onClick={() => setNewSeries('')}
              >
                Create a series<span aria-hidden="true">+</span>
              </button>
            )}
          </nav>
          {newSeries !== null && (
            <form className="mp-new-series-form" onSubmit={addSeries}>
              <label htmlFor="mp-series-title">Series name</label>
              <input
                id="mp-series-title"
                autoFocus
                value={newSeries}
                onChange={(event) => setNewSeries(event.target.value)}
              />
              <div>
                <button className="mp-button" type="submit">
                  Create series
                </button>
                <button
                  className="mp-text-button"
                  type="button"
                  onClick={() => setNewSeries(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {editing && (
            <div className="mp-draft-note">
              <span className="mp-status-dot" />
              <span>
                {mode === 'prototype'
                  ? changed
                    ? 'Unapplied changes'
                    : 'No unapplied changes'
                  : 'Private draft'}
              </span>
              <small>
                {mode === 'prototype'
                  ? storageError
                    ? 'This tab only'
                    : 'Saved in this browser'
                  : saveStatus}
              </small>
              <button
                className="mp-button mp-primary"
                ref={reviewTrigger}
                disabled={mode === 'prototype' ? !changed : !canReview}
                onClick={() => setReview(true)}
              >
                Review changes
                <Icon name="arrow-right" />
              </button>
            </div>
          )}
        </aside>
        <section
          className="mp-collection"
          aria-labelledby="mp-collection-title"
        >
          <header className="mp-collection-header">
            <div
              className={!series && !editing ? 'mp-visually-hidden' : undefined}
            >
              <h2 id="mp-collection-title">
                {series?.title ??
                  (editing ? 'Your playlists' : 'Selected playlists')}
              </h2>
              <p className="mp-small">
                {series
                  ? `${matching.length} playlists · In sequence`
                  : `${matching.length} playlists`}
              </p>
            </div>
          </header>
          {editing && (
            <>
              <div
                className="mp-library-filters"
                role="group"
                aria-label="Library filter"
              >
                {(
                  [
                    ['all', 'All', visibleIds.length],
                    [
                      'selected',
                      'In gallery',
                      visibleIds.filter((id) => catalog.selected.includes(id))
                        .length,
                    ],
                    [
                      'unselected',
                      'Not included',
                      visibleIds.filter((id) => !catalog.selected.includes(id))
                        .length,
                    ],
                  ] as const
                ).map(([value, label, count]) => (
                  <button
                    key={value}
                    aria-pressed={libraryFilter === value}
                    onClick={() => setLibraryFilter(value)}
                  >
                    {label}
                    <span aria-hidden="true">{count}</span>
                  </button>
                ))}
              </div>
              <p className="mp-edit-hint">
                Choose what appears in your gallery. Open a playlist to add
                notes or arrange its place in a series.
              </p>
            </>
          )}
          {storageError && (
            <p className="mp-notice" role="status">
              {storageError}
            </p>
          )}
          <div
            ref={gallery}
            className={`mp-grid${editing ? ' mp-grid-editing' : ''}`}
          >
            {displayed.map((id, index) =>
              renderCard(playlists.find((item) => item.id === id)!, index)
            )}
          </div>
          <MusicScrollCue
            gallery={gallery}
            collection={`${seriesId}:${editing}:${displayed.join(',')}`}
          />
          {!matching.length && (
            <div className="mp-empty">
              <Icon name="music" size={32} />
              <h3>
                {editing && libraryFilter === 'unselected'
                  ? 'Every playlist is included.'
                  : editing && libraryFilter === 'selected'
                    ? 'No playlists included yet'
                    : 'This series is still empty'}
              </h3>
              <p>
                {editing && libraryFilter !== 'all'
                  ? 'Choose All to see the rest of your library.'
                  : 'Open a playlist from All playlists to add it to this series.'}
              </p>
              <button
                className="mp-button"
                onClick={() => {
                  setLibraryFilter('all');
                  chooseSeries(null);
                }}
              >
                Browse all playlists
              </button>
            </div>
          )}
          <p className="mp-sample-note">
            {mode === 'prototype' ? (
              'These covers and tracks are illustrative fixtures for design review.'
            ) : (
              <>
                <SpotifyIcon /> Playlist artwork and track information from
                Spotify.
              </>
            )}
          </p>
        </section>
      </main>
      <p className="mp-announcement" role="status" aria-live="polite">
        {announcement}
      </p>
      <dialog
        ref={dialog}
        className="mp-detail"
        data-editing={editing || undefined}
        aria-labelledby="mp-detail-title"
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            const controls = Array.from(
              dialog.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]'
              ) ?? []
            ).filter(
              (element) =>
                element.tabIndex >= 0 && element.getClientRects().length
            );
            const index = controls.indexOf(
              document.activeElement as HTMLElement
            );
            const wrap = event.shiftKey
              ? index <= 0
              : index < 0 || index === controls.length - 1;
            if (wrap && controls.length) {
              event.preventDefault();
              controls[event.shiftKey ? controls.length - 1 : 0].focus();
            }
            return;
          }
          const scroller =
            dialog.current?.querySelector<HTMLElement>('.mp-detail-scroll');
          if (!scroller || scroller.contains(event.target as Node)) return;
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          const distance: Record<string, number> = {
            ArrowDown: 40,
            ArrowUp: -40,
            PageDown: scroller.clientHeight * 0.85,
            PageUp: -scroller.clientHeight * 0.85,
            Home: -scroller.scrollHeight,
            End: scroller.scrollHeight,
          };
          if (!(event.key in distance)) return;
          // The toolbar sits outside the scrollport, so target its content explicitly.
          event.preventDefault();
          scroller.scrollBy({ top: distance[event.key], behavior: 'instant' });
        }}
        onCancel={(event) => {
          event.preventDefault();
          closePlaylist();
        }}
        {...backdrop}
      >
        {current && (
          <>
            <div className="mp-detail-bar">
              <span>
                {series
                  ? `${series.title} / ${String(currentIndex + 1).padStart(2, '0')}`
                  : `${currentIndex + 1} of ${focusIds.length}`}
              </span>
              <div className="mp-detail-actions">
                <div
                  className="mp-detail-pagination"
                  role="group"
                  aria-label="Playlist navigation"
                >
                  <button
                    className="mp-icon-button mp-icon-button--tonal"
                    disabled={currentIndex <= 0}
                    onClick={() => openPlaylist(focusIds[currentIndex - 1])}
                    aria-label="Previous playlist"
                  >
                    <Icon name="arrow-left" size={24} />
                  </button>
                  <button
                    className="mp-icon-button mp-icon-button--filled"
                    disabled={
                      currentIndex < 0 || currentIndex >= focusIds.length - 1
                    }
                    onClick={() => openPlaylist(focusIds[currentIndex + 1])}
                    aria-label="Next playlist"
                  >
                    <Icon name="arrow-right" size={24} />
                  </button>
                </div>
                <button
                  className="mp-icon-button mp-icon-button--tonal mp-detail-close"
                  onClick={closePlaylist}
                  aria-label="Close playlist"
                >
                  <Icon name="x" size={24} />
                </button>
              </div>
            </div>
            <div
              className="mp-detail-scroll"
              role="region"
              aria-label="Playlist details"
              tabIndex={-1}
            >
              <div className="mp-detail-art-column">
                <div className="mp-detail-art" data-focus-cover="">
                  <Cover playlist={current} />
                </div>
                <div className="mp-detail-context">
                  {catalog.series
                    .filter((item) => item.playlistIds.includes(current.id))
                    .map((item) => (
                      <p key={item.id} className="mp-detail-series">
                        <span>{item.title}</span>
                        <span>
                          {String(
                            item.playlistIds.indexOf(current.id) + 1
                          ).padStart(2, '0')}{' '}
                          / {String(item.playlistIds.length).padStart(2, '0')}
                        </span>
                      </p>
                    ))}
                </div>
              </div>
              <div className="mp-detail-body">
                <h2 id="mp-detail-title" tabIndex={-1} aria-live="polite">
                  {current.title}
                </h2>
                <p className="mp-detail-meta">
                  {current.trackCount} items{runtime && ` · ${runtime}`}
                  {mode === 'prototype' && ' · Sample sequence'}
                </p>
                {!editing && catalog.notes[current.id] && (
                  <p className="mp-playlist-note">
                    {catalog.notes[current.id]}
                  </p>
                )}
                {mode === 'prototype' ? (
                  <>
                    <button className="mp-button mp-spotify" disabled>
                      Open in Spotify
                      <Icon name="external" />
                    </button>
                    <p className="mp-spotify-note">
                      Sample playlist · No Spotify link
                    </p>
                  </>
                ) : (
                  <a
                    className="mp-button mp-spotify"
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SpotifyIcon />
                    Open in Spotify
                    <Icon name="external" />
                  </a>
                )}
              </div>
              {editing && (
                <div className="mp-context-editor">
                  <label htmlFor="mp-playlist-note">Your notes</label>
                  <textarea
                    id="mp-playlist-note"
                    rows={3}
                    placeholder="What should someone know before listening?"
                    value={draft.notes[current.id] ?? ''}
                    onChange={(event) =>
                      change({
                        ...draft,
                        notes: {
                          ...draft.notes,
                          [current.id]: event.target.value,
                        },
                      })
                    }
                  />
                  <fieldset className="mp-visibility-editor">
                    <legend>In your gallery</legend>
                    <label className="mp-check">
                      <MusicSelectionControl
                        aria-label="Include in gallery"
                        checked={draft.selected.includes(current.id)}
                        onChange={() => select(current.id)}
                      />
                      Include in gallery
                    </label>
                    <label className="mp-check">
                      <MusicSelectionControl
                        checked={draft.lead === current.id}
                        onChange={() =>
                          change({
                            ...draft,
                            lead: draft.lead === current.id ? null : current.id,
                            selected: draft.selected.includes(current.id)
                              ? draft.selected
                              : [...draft.selected, current.id],
                          })
                        }
                      />
                      Feature in the gallery
                    </label>
                  </fieldset>
                  <fieldset>
                    <legend>Series</legend>
                    {draft.series.map((item) => (
                      <label className="mp-check" key={item.id}>
                        <MusicSelectionControl
                          checked={item.playlistIds.includes(current.id)}
                          onChange={() => membership(item.id, current.id)}
                        />
                        {item.title}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}
              <div className="mp-detail-tracks">
                <div className="mp-track-heading">
                  <h3>Track list</h3>
                  <span>Original order</span>
                </div>
                <ol className="mp-track-list">
                  {sampleTracks.map((track, index) => (
                    <li
                      key={index}
                      className={
                        track.unavailable ? 'mp-track-unavailable' : undefined
                      }
                    >
                      <span className="mp-track-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>
                        <span className="mp-track-title">{track.title}</span>
                        <span className="mp-track-artist">{track.artist}</span>
                      </span>
                      <span className="mp-track-duration">
                        {track.duration}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        )}
      </dialog>
      {review && (
        <dialog
          ref={reviewDialog}
          className="mp-review"
          aria-labelledby="mp-review-title"
          onCancel={(event) => {
            event.preventDefault();
            closeReview();
          }}
          onKeyDown={(event) => {
            const scroller =
              reviewDialog.current?.querySelector<HTMLElement>(
                '.mp-review-body'
              );
            if (
              !scroller ||
              scroller.contains(event.target as Node) ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey
            )
              return;
            const distances: Record<string, number> = {
              ArrowDown: 40,
              ArrowUp: -40,
              PageDown: scroller.clientHeight * 0.85,
              PageUp: -scroller.clientHeight * 0.85,
              Home: -scroller.scrollHeight,
              End: scroller.scrollHeight,
            };
            if (!(event.key in distances)) return;
            event.preventDefault();
            scroller.scrollBy({
              top: distances[event.key],
              behavior: 'instant',
            });
          }}
        >
          <header className="mp-review-header">
            <div>
              <h2 id="mp-review-title" tabIndex={-1}>
                Review your collection
              </h2>
              <p>Check the order and context before applying your changes.</p>
            </div>
            <button
              className="mp-icon-button mp-icon-button--tonal"
              aria-label="Close review"
              onClick={closeReview}
            >
              <Icon name="x" size={24} />
            </button>
          </header>
          <div
            className="mp-review-body"
            role="region"
            aria-label="Collection review"
            tabIndex={-1}
          >
            <dl className="mp-review-summary">
              <div>
                <dt>In gallery</dt>
                <dd>{draft.selected.length}</dd>
              </div>
              <div>
                <dt>Not included</dt>
                <dd>{playlists.length - draft.selected.length}</dd>
              </div>
              <div>
                <dt>Series</dt>
                <dd>{draft.series.length}</dd>
              </div>
            </dl>
            <section className="mp-review-order">
              <div className="mp-review-section-heading">
                <h3>Gallery order</h3>
                <button
                  className="mp-text-button"
                  onClick={() => {
                    setLibraryFilter('all');
                    chooseSeries(null);
                    closeReview();
                    gallery.current
                      ?.querySelector<HTMLButtonElement>(
                        '.mp-order-buttons button:not(:disabled)'
                      )
                      ?.focus();
                  }}
                >
                  Edit order
                </button>
              </div>
              <ol>
                {draft.order
                  .filter((id) => draft.selected.includes(id))
                  .map((id, index) => {
                    const playlist = playlists.find((item) => item.id === id)!;
                    return (
                      <li key={id}>
                        <span className="mp-review-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="mp-review-cover">
                          <Cover playlist={playlist} />
                        </span>
                        <div>
                          <span className="mp-review-playlist-title">
                            {playlist.title}
                          </span>
                          {id === draft.lead && (
                            <span className="mp-review-feature-label">
                              Featured in your gallery
                            </span>
                          )}
                          {draft.notes[id] && (
                            <p className="mp-review-note">{draft.notes[id]}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ol>
            </section>
            <aside className="mp-review-context">
              <section className="mp-review-feature">
                <h3>Featured playlist</h3>
                {draft.lead ? (
                  <>
                    <div className="mp-review-feature-cover">
                      <Cover
                        playlist={
                          playlists.find((item) => item.id === draft.lead)!
                        }
                      />
                    </div>
                    <p>
                      {playlists.find((item) => item.id === draft.lead)?.title}
                    </p>
                  </>
                ) : (
                  <p>No featured playlist.</p>
                )}
              </section>
              {draft.series.map((item) => (
                <section key={item.id} className="mp-review-series">
                  <h3>{item.title}</h3>
                  {item.playlistIds.some((id) =>
                    draft.selected.includes(id)
                  ) ? (
                    <ol>
                      {item.playlistIds
                        .filter((id) => draft.selected.includes(id))
                        .map((id) => (
                          <li key={id}>
                            {
                              playlists.find((playlist) => playlist.id === id)
                                ?.title
                            }
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p>No selected playlists.</p>
                  )}
                </section>
              ))}
            </aside>
          </div>
          <footer className="mp-review-actions">
            <p>
              {mode === 'prototype'
                ? 'This action stays in this browser.'
                : 'Publish this saved collection to willie.page.'}
            </p>
            <button className="mp-button mp-tonal" onClick={closeReview}>
              Back to editing
            </button>
            <button
              className="mp-button mp-primary"
              disabled={mode !== 'prototype' && !canReview}
              onClick={async () => {
                if (mode !== 'prototype') {
                  closeReview();
                  await onPublish?.(draft);
                  return;
                }
                flushSync(() => {
                  setLive(structuredClone(draft));
                  setReview(false);
                  setEditing(false);
                  setLibraryFilter('all');
                });
                setAnnouncement('Changes applied to this prototype.');
                curateToggle.current?.focus({ preventScroll: true });
              }}
            >
              {mode === 'prototype'
                ? 'Apply to prototype'
                : 'Publish collection'}
              <Icon name="check" />
            </button>
          </footer>
        </dialog>
      )}
    </div>
  );
}
