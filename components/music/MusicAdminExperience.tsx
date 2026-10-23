'use client';

import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';

import {
  type Catalog,
  type PlaylistView,
  catalogForViewing,
} from '@/lib/music/presentation';

import MusicChrome from './MusicChrome';
import MusicCurationReview from './MusicCurationReview';
import MusicExperienceView, {
  type MusicCollectionView,
} from './MusicExperienceView';
import { musicPlaylistCuration } from './MusicPlaylistEditor';
import MusicSetup from './MusicSetup';
import { useMusicBrowsing } from './useMusicBrowsing';
import { useMusicCuration } from './useMusicCuration';
import { useMusicDocument } from './useMusicDocument';
import { useMusicGalleryCuration } from './useMusicGalleryCuration';

interface MusicAdminExperienceProps {
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  playlists: PlaylistView[];
  initialCatalog: Catalog;
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
export default function MusicAdminExperience({
  playlists,
  initialCatalog,
  loading = false,
  loadError,
  onRetry,
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
}: MusicAdminExperienceProps) {
  const { document: catalogDocument, changed } = useMusicDocument(
    { initialCatalog, onChange, loading, setupInitially },
    (open) => curation.setup.restore(open)
  );
  const curation = useMusicCuration({
    mode: 'admin',
    catalogDocument,
    onPublish,
    clearFilter: () => browsing.clearFilter(),
    setupInitially,
    resetSelection: () => browsing.resetSelection(),
  });
  const { editing, announcement, changeCatalog, announce } = curation;
  const setup = curation.setup;
  const draft = catalogDocument.draft;
  const catalog = catalogForViewing(catalogDocument.live, draft, 'admin');
  const browsing = useMusicBrowsing({
    catalog,
    initialCatalog,
    mode: 'admin',
    editing,
    playlists,
    paletteEnabled: !setup.isOpen,
  });
  const collection: MusicCollectionView = {
    catalog,
    playlists,
    browsing,
    loading,
    loadError,
    onRetry,
  };
  const gallery = useMusicGalleryCuration({
    collection,
    editing,
    onChange: changeCatalog,
    announce,
  });
  return (
    <MusicExperienceView
      collection={collection}
      mode="admin"
      editing={editing}
      interactionLocked={interactionLocked}
      setup={
        setup.isOpen && (
          <MusicSetup
            playlists={playlists}
            connected={connected}
            onConnect={onConnect}
            catalog={draft}
            onCancel={setup.cancel}
            onComplete={setup.complete}
          />
        )
      }
      chrome={
        <MusicChrome
          editing={editing}
          onToggleCuration={curation.toggle}
          onOpenSetup={setup.open}
          onRefresh={onRefresh}
          adminMenuItems={adminMenuItems}
        />
      }
      gallery={gallery}
      detail={editing ? musicPlaylistCuration(draft, changeCatalog) : undefined}
      announcement={announcement}
      overlays={
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
      }
    />
  );
}
