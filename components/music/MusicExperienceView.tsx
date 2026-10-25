import type { ReactNode } from 'react';

import TopBar from '@/components/site/TopBar';

import type {
  Catalog,
  MusicMode,
  PlaylistView,
} from '@/lib/music/presentation';

import MusicCollectionGallery, {
  type MusicGallerySlots,
} from './MusicCollectionGallery';
import MusicDetail, { type MusicDetailSlots } from './MusicDetail';
import type { MusicBrowsing } from './useMusicBrowsing';

export interface MusicCollectionView {
  catalog: Catalog;
  playlists: PlaylistView[];
  browsing: MusicBrowsing;
  initialDetail?: string;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
}
interface Props {
  collection: MusicCollectionView;
  mode?: MusicMode;
  editing?: boolean;
  interactionLocked?: boolean;
  setup?: ReactNode;
  chrome?: ReactNode;
  overlays?: ReactNode;
  announcement?: string;
  gallery?: MusicGallerySlots;
  detail?: MusicDetailSlots;
}
export default function MusicExperienceView(props: Props) {
  const {
    collection,
    editing = false,
    interactionLocked = false,
    setup,
  } = props;
  const { loading, loadError, browsing } = collection;
  const inSetup = Boolean(setup);
  const activeEditing = !inSetup && editing;
  return (
    <div
      className="music"
      data-editing={activeEditing || undefined}
      data-reordering={(activeEditing && browsing.reordering) || undefined}
      aria-busy={(loading && !loadError) || interactionLocked}
      aria-disabled={interactionLocked || undefined}
      inert={interactionLocked}
    >
      <MusicExperienceLayout {...props} editing={editing} inSetup={inSetup} />
    </div>
  );
}
interface LayoutProps extends Props {
  editing: boolean;
  inSetup: boolean;
}
function MusicExperienceLayout({
  collection,
  mode = 'public',
  editing,
  inSetup,
  setup,
  chrome,
  overlays,
  announcement,
  gallery,
  detail,
}: LayoutProps) {
  const publicEmpty =
    collection.browsing.selection.publicEmpty && !collection.loading;
  return (
    <>
      {setup}
      {!inSetup &&
        (chrome ?? (
          <TopBar column="wide" crumbs={[{ label: 'Music', href: '/music' }]} />
        ))}
      {/* The series form keeps its draft while setup temporarily replaces the gallery. */}
      <main
        hidden={inSetup}
        id={inSetup ? undefined : 'main'}
        className={`music-shell${publicEmpty ? ' music-shell-public-empty' : ''}`}
      >
        <MusicCollectionGallery
          collection={collection}
          editing={editing}
          {...gallery}
        />
      </main>
      {!inSetup && (
        <>
          {announcement !== undefined && (
            <p className="sr-only" role="status" aria-live="polite">
              {announcement}
            </p>
          )}
          <MusicDetail
            collection={collection}
            mode={mode}
            editing={editing}
            {...detail}
          />
          {overlays}
        </>
      )}
    </>
  );
}
