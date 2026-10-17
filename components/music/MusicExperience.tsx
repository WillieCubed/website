'use client';

import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';

import {
  type Catalog,
  type MusicMode,
  type PlaylistView,
  catalogForViewing,
} from '@/lib/music/presentation';

import MusicChrome from './MusicChrome';
import MusicCollectionGallery from './MusicCollectionGallery';
import MusicCurationReview from './MusicCurationReview';
import MusicDetail from './MusicDetail';
import MusicExperienceFrame from './MusicExperienceFrame';
import MusicSetup from './MusicSetup';
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
  const { document: catalogDocument, changed } = useMusicDocument(
    { initialCatalog, onChange, loading, setupInitially },
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
  const catalog = catalogForViewing(catalogDocument.live, draft, mode);
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
      interactionLocked={interactionLocked}
      publicEmpty={publicEmpty}
      setupView={
        <MusicSetup
          playlists={playlists}
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
          adminMenuItems={adminMenuItems}
        />
      }
      overlays={
        <>
          <p className="music-announcement" role="status" aria-live="polite">
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
            series={series}
            navigation={navigation}
            onChange={changeCatalog}
          />
          <MusicCurationReview
            key={String(editing)}
            editing={editing}
            changed={changed}
            published={published}
            saveStatus={saveStatus}
            loading={loading}
            canReview={canReview}
            draft={draft}
            playlists={playlists}
            onEditOrder={browsing.editOrder}
            applyReview={curation.applyReview}
          />
        </>
      }
    >
      <MusicCollectionGallery
        catalog={catalog}
        playlists={playlists}
        editing={editing}
        loading={loading}
        loadError={loadError}
        onRetry={onRetry}
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
