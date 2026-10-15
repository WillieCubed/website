'use client';

import { type ComponentType, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';

import {
  appendCatalogSeries,
  dropCatalog,
  reorderCatalog,
  toggleCatalogFeature,
  toggleCatalogMembership,
  toggleCatalogSelection,
  updateCatalogNote,
} from '@/lib/music/catalog-edits';
import {
  type Catalog,
  type MusicLibraryFilter,
  type MusicMode,
  type PlaylistView,
  canReorderPlaylists,
  catalogForViewing,
  gallerySelection,
} from '@/lib/music/presentation';

import MusicChrome from './MusicChrome';
import MusicCollectionHeader from './MusicCollectionHeader';
import MusicDetail from './MusicDetail';
import MusicExperienceFrame from './MusicExperienceFrame';
import MusicGallery, {
  MusicEmptyCollection,
  MusicLibraryFilters,
} from './MusicGallery';
import MusicPlaylistGrid from './MusicPlaylistGrid';
import MusicPublicationBar from './MusicPublicationBar';
import MusicRail from './MusicRail';
import MusicReview from './MusicReview';
import MusicSeriesNavigation from './MusicSeriesNavigation';
import MusicSetup from './MusicSetup';
import { galleryItems } from './music-gallery';
import './music-prototype.css';
import { useMusicCatalog } from './useMusicCatalog';
import { useMusicCatalogLoading } from './useMusicCatalogLoading';
import { useMusicPaletteNavigation } from './useMusicPaletteNavigation';
import { useMusicPlaylistDialog } from './useMusicPlaylistDialog';
import { useMusicPlaylistDrag } from './useMusicPlaylistDrag';
import { useMusicSetup } from './useMusicSetup';
import { usePrototypeMusicCatalog } from './usePrototypeMusicCatalog';

export interface MusicExperienceProps {
  initialSeries?: string;
  initialDetail?: string;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  playlists: PlaylistView[];
  initialCatalog: Catalog;
  mode?: MusicMode;
  validCatalog?: (value: unknown) => value is Catalog;
  Cover?: ComponentType<{ playlist: PlaylistView }>;
  onChange?: (catalog: Catalog) => void;
  onPublish?: (reviewed: Catalog) => Promise<void>;
  saveStatus?: string;
  published?: boolean;
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
  initialSeries,
  initialDetail,
  loading = false,
  loadError,
  onRetry,
  mode = 'public',
  validCatalog,
  Cover,
  onChange,
  onPublish,
  saveStatus,
  published,
  canReview,
  interactionLocked = false,
  connected,
  onConnect,
  onRefresh,
  adminMenuItems,
  setupInitially = false,
}: MusicExperienceProps) {
  const catalogDocument = useMusicCatalog(initialCatalog, onChange);
  const [editing, setEditing] = useState(mode === 'admin');
  const [reordering, setReordering] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<MusicLibraryFilter>('all');
  const [announcement, announce] = useState('');
  const [seriesId, setSeriesId] = useState<string | null>(
    initialCatalog.series.some((series) => series.id === initialSeries)
      ? initialSeries!
      : null
  );
  const gallery = useRef<HTMLDivElement>(null);
  const curateToggle = useRef<HTMLButtonElement>(null);
  const setupToggle = useRef<HTMLButtonElement>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const setup = useMusicSetup({
    mode,
    initiallyOpen: setupInitially,
    acceptCatalog: (next) => {
      catalogDocument.acceptSetup(next);
      setEditing(true);
      setSeriesId(null);
      clearFilter();
    },
    focusCuration: () => curateToggle.current?.focus({ preventScroll: true }),
    focusSetup: () => setupToggle.current?.focus({ preventScroll: true }),
  });
  useMusicCatalogLoading(
    loading,
    initialCatalog,
    setupInitially,
    (next, showSetup) => {
      catalogDocument.restore(next, next);
      setup.restore(showSetup);
    }
  );
  const prototype = usePrototypeMusicCatalog({
    mode,
    live: catalogDocument.live,
    draft: catalogDocument.draft,
    validCatalog,
    restore: catalogDocument.restore,
  });
  const draft = catalogDocument.draft;
  const catalog = catalogForViewing(catalogDocument.live, draft, mode, editing);
  const selection = gallerySelection(
    catalog,
    mode,
    editing,
    seriesId,
    libraryFilter
  );
  const { series, matching, displayed, lead, order } = selection;
  const publicEmpty = selection.publicEmpty && !loading;
  const navigation = useMusicPlaylistDialog({
    catalog,
    mode,
    initialDetail,
    initialCatalog,
    editing,
    playlists,
    displayed,
    gallery,
    seriesId,
    setSeriesId,
    finishReordering: () => setReordering(false),
  });
  const drag = useMusicPlaylistDrag({
    enabled: canReorderPlaylists(editing, reordering, libraryFilter === 'all'),
    onDrop: (source, target) =>
      changeCatalog(
        dropCatalog(draft, order, source, target, series?.id ?? null)
      ),
  });
  useMusicPaletteNavigation({
    mode,
    setup: setup.isOpen,
    catalog,
    editing,
    playlists,
    displayed,
    revealAll: () => {
      setSeriesId(null);
      clearFilter();
    },
  });
  const current = playlists.find((item) => item.id === navigation.focused);
  const changed =
    JSON.stringify(catalogDocument.live) !== JSON.stringify(draft);
  const items = galleryItems({
    displayed,
    playlists,
    catalog,
    lead,
    focused: navigation.focused,
    inSeries: Boolean(series),
    total: matching.length,
    editing,
    loading,
    reordering,
    filterAll: libraryFilter === 'all',
  });

  function createSeries(title: string) {
    const id = `series-${crypto.randomUUID()}`;
    changeCatalog(appendCatalogSeries(draft, id, title));
    navigation.chooseSeries(id);
  }
  function changeCatalog(next: Catalog) {
    catalogDocument.commit(next);
    announce('Draft saved in this browser.');
  }
  function clearFilter() {
    setLibraryFilter('all');
  }
  function chooseFilter(next: MusicLibraryFilter) {
    setLibraryFilter(next);
    setReordering(false);
  }
  function browseAll() {
    clearFilter();
    navigation.chooseSeries(null);
  }
  function openSetup() {
    setup.open();
    setReviewOpen(false);
  }
  function toggleCuration() {
    setEditing(!editing);
    setReviewOpen(false);
    clearFilter();
  }
  function movePlaylist(id: string, step: number) {
    changeCatalog(reorderCatalog(draft, id, step, series?.id ?? null));
    const title = playlists.find((playlist) => playlist.id === id)?.title;
    announce(`${title} moved ${step < 0 ? 'earlier' : 'later'}.`);
  }
  function editOrder() {
    flushSync(() => {
      clearFilter();
      navigation.chooseSeries(null);
      setReordering(true);
    });
    gallery.current
      ?.querySelector<HTMLButtonElement>(
        '.mp-order-buttons button:not(:disabled)'
      )
      ?.focus();
  }
  async function applyReview() {
    if (mode !== 'prototype') {
      await onPublish?.(draft);
      return;
    }
    flushSync(() => {
      catalogDocument.apply();
      setReviewOpen(false);
      setEditing(false);
      clearFilter();
    });
    announce('Changes applied to this prototype.');
    curateToggle.current?.focus();
  }
  const seriesNavigation = (
    <MusicSeriesNavigation
      series={catalog.series}
      selected={catalog.selected}
      currentSeriesId={series?.id}
      editing={editing}
      loading={loading}
      playlistCount={playlists.length}
      href={navigation.href}
      chooseSeries={navigation.chooseSeries}
    />
  );
  return (
    <MusicExperienceFrame
      setup={setup.isOpen}
      editing={editing}
      reordering={reordering}
      loading={loading}
      loadError={loadError}
      ready={prototype.ready}
      interactionLocked={interactionLocked}
      publicEmpty={publicEmpty}
      setupView={
        <MusicSetup
          playlists={playlists}
          Cover={Cover}
          mode={mode}
          connected={connected}
          onConnect={onConnect}
          catalog={draft}
          onCancel={setup.cancel}
          onComplete={setup.complete}
        />
      }
      chrome={
        <MusicChrome
          mode={mode}
          editing={editing}
          onToggleCuration={toggleCuration}
          onOpenSetup={openSetup}
          onRefresh={onRefresh}
          setupToggle={setupToggle}
          curateToggle={curateToggle}
          adminMenuItems={adminMenuItems}
        />
      }
      overlays={
        <>
          <MusicPublicationBar
            visible={editing}
            mode={mode}
            changed={changed}
            published={published}
            storageError={prototype.error}
            saveStatus={saveStatus}
            loading={loading}
            canReview={canReview}
            onReview={() => setReviewOpen(true)}
          />
          <p className="mp-announcement" role="status" aria-live="polite">
            {announcement}
          </p>
          <MusicDetail
            initialDetail={initialDetail}
            focused={navigation.focused}
            reordering={reordering}
            closeHref={navigation.href(seriesId, null)}
            current={current}
            dialog={navigation.dialog}
            backdrop={navigation.backdrop}
            mode={mode}
            editing={editing}
            catalog={catalog}
            draft={draft}
            updateNote={(id, note) =>
              changeCatalog(updateCatalogNote(draft, id, note))
            }
            toggleFeature={(id) =>
              changeCatalog(toggleCatalogFeature(draft, id))
            }
            select={(id) => changeCatalog(toggleCatalogSelection(draft, id))}
            membership={(id, member) =>
              changeCatalog(toggleCatalogMembership(draft, id, member))
            }
            Cover={Cover}
            currentIndex={navigation.currentIndex}
            focusIds={navigation.focusIds}
            series={series}
            openPlaylist={navigation.openPlaylist}
            closePlaylist={navigation.closePlaylist}
          />
          <MusicReview
            open={reviewOpen}
            onClose={() => setReviewOpen(false)}
            onEditOrder={editOrder}
            draft={draft}
            playlists={playlists}
            Cover={Cover}
            mode={mode}
            canReview={canReview}
            applyReview={applyReview}
          />
        </>
      }
    >
      <MusicRail
        publicEmpty={publicEmpty}
        editing={editing}
        loading={loading}
        seriesNavigation={seriesNavigation}
        onCreateSeries={createSeries}
      />
      <MusicGallery
        publicEmpty={publicEmpty}
        loadError={loadError}
        storageError={prototype.error}
        mode={mode}
        header={
          <MusicCollectionHeader
            series={series}
            editing={editing}
            loading={loading}
            loadError={loadError}
            onRetry={onRetry}
            hasSeries={catalog.series.length > 0}
            count={matching.length}
            reordering={reordering}
            filterAll={libraryFilter === 'all'}
            onToggleReordering={() => setReordering(!reordering)}
            seriesNavigation={seriesNavigation}
          />
        }
        filters={
          <MusicLibraryFilters
            editing={editing}
            libraryFilter={libraryFilter}
            setLibraryFilter={chooseFilter}
            loading={loading}
          />
        }
        empty={
          <MusicEmptyCollection
            loading={loading}
            count={matching.length}
            editing={editing}
            libraryFilter={libraryFilter}
            hasLibrary={playlists.length > 0}
            hasSelection={catalog.selected.length > 0}
            onBrowse={browseAll}
          />
        }
      >
        <MusicPlaylistGrid
          items={items}
          editing={editing}
          loading={loading}
          playlistCount={playlists.length}
          href={(id) => navigation.href(seriesId, id)}
          collectionKey={`${seriesId}:${editing}:${displayed.join(',')}`}
          gallery={gallery}
          Cover={Cover}
          onDragStart={drag.start}
          onDrop={drag.drop}
          openPlaylist={navigation.openPlaylist}
          select={(id) => changeCatalog(toggleCatalogSelection(draft, id))}
          reorder={movePlaylist}
        />
      </MusicGallery>
    </MusicExperienceFrame>
  );
}
