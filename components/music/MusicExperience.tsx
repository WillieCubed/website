'use client';
import { type ComponentType } from 'react';

import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';

import {
  type Catalog,
  type MusicMode,
  type PlaylistView,
  catalogForViewing,
} from '@/lib/music/presentation';

import MusicChrome from './MusicChrome';
import MusicCollectionGallery from './MusicCollectionGallery';
import type { MusicCoverProps } from './MusicCover';
import MusicCurationReview from './MusicCurationReview';
import MusicDetail from './MusicDetail';
import MusicExperienceFrame from './MusicExperienceFrame';
import MusicSetup from './MusicSetup';
import './music-prototype.css';
import { useMusicBrowsing } from './useMusicBrowsing';
import { useMusicCuration } from './useMusicCuration';
import { useMusicDocument } from './useMusicDocument';

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
  Cover?: ComponentType<MusicCoverProps>;
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
  const {
    document: catalogDocument,
    prototype,
    changed,
  } = useMusicDocument(
    { initialCatalog, onChange, loading, setupInitially, mode, validCatalog },
    (open) => curation.setup.restore(open)
  );
  const curation = useMusicCuration({
    mode,
    catalogDocument,
    onPublish,
    clearFilter: () => browsing.clearFilter(),
    setupInitially,
    resetSelection: () => browsing.resetSelection(),
  });
  const { editing, announcement, changeCatalog, announce } = curation;
  const setup = curation.setup;
  const draft = catalogDocument.draft;
  const catalog = catalogForViewing(catalogDocument.live, draft, mode, editing);
  const browsing = useMusicBrowsing({
    catalog,
    initialCatalog,
    initialSeries,
    initialDetail,
    mode,
    editing,
    playlists,
    paletteEnabled: !setup.isOpen,
  });
  const { navigation, seriesId, reordering } = browsing;
  const { series } = browsing.selection;
  const publicEmpty = browsing.selection.publicEmpty && !loading;
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
          onToggleCuration={curation.toggle}
          onOpenSetup={setup.open}
          onRefresh={onRefresh}
          setupToggle={setup.setupToggle}
          curateToggle={setup.curateToggle}
          adminMenuItems={adminMenuItems}
        />
      }
      overlays={
        <>
          <p className="mp-announcement" role="status" aria-live="polite">
            {announcement}
          </p>
          <MusicDetail
            initialDetail={initialDetail}
            catalog={catalog}
            draft={draft}
            playlists={playlists}
            mode={mode}
            editing={editing}
            reordering={reordering}
            closeHref={navigation.href(seriesId, null)}
            Cover={Cover}
            series={series}
            navigation={navigation}
            onChange={changeCatalog}
          />
          <MusicCurationReview
            key={String(editing)}
            editing={editing}
            mode={mode}
            changed={changed}
            published={published}
            storageError={prototype.error}
            saveStatus={saveStatus}
            loading={loading}
            canReview={canReview}
            draft={draft}
            playlists={playlists}
            Cover={Cover}
            onEditOrder={browsing.editOrder}
            applyReview={curation.applyReview}
          />
        </>
      }
    >
      <MusicCollectionGallery
        catalog={catalog}
        playlists={playlists}
        mode={mode}
        editing={editing}
        loading={loading}
        loadError={loadError}
        storageError={prototype.error}
        onRetry={onRetry}
        Cover={Cover}
        selection={browsing.selection}
        browsing={browsing}
        navigation={navigation}
        draft={draft}
        onChange={changeCatalog}
        announce={announce}
      />
    </MusicExperienceFrame>
  );
}
