'use client';
import type { MusicCatalog } from '@/lib/music/types';

import MusicExperience from './MusicExperience';
import type { AdminCollectionView } from './music-admin-collection';

interface CollectionControls {
  generation: number;
  status: string;
  busy: boolean;
  canReview: boolean;
  published: boolean;
  onChange: (catalog: MusicCatalog) => void;
  onPublish: (catalog: MusicCatalog) => Promise<void>;
  onConnect: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenHistory: () => void;
}
interface Props extends CollectionControls, AdminCollectionView {
  error: string;
  onRetry: () => void;
}
export default function MusicAdminCollection({
  playlists,
  initialCatalog,
  loading,
  connected,
  setupInitially,
  generation,
  onChange,
  onPublish,
  busy,
  canReview,
  status,
  published,
  onConnect,
  onRefresh,
  onOpenHistory,
  error,
  onRetry,
}: Props) {
  return (
    <MusicExperience
      key={generation}
      mode="admin"
      playlists={playlists}
      loading={loading}
      loadError={error}
      onRetry={onRetry}
      initialCatalog={initialCatalog}
      onChange={onChange}
      onPublish={onPublish}
      interactionLocked={busy}
      canReview={canReview}
      saveStatus={status}
      published={published}
      connected={connected}
      onConnect={onConnect}
      onRefresh={onRefresh}
      setupInitially={setupInitially}
      adminMenuItems={[
        { label: 'History', onSelect: onOpenHistory },
        ...(!connected
          ? [{ label: 'Reconnect Spotify', onSelect: () => void onConnect() }]
          : []),
      ]}
    />
  );
}
