'use client';
import { type ComponentType, useState } from 'react';

import type {
  Catalog,
  MusicMode,
  PlaylistView,
} from '@/lib/music/presentation';

import type { MusicCoverProps } from './MusicCover';
import MusicPublicationBar from './MusicPublicationBar';
import MusicReview from './MusicReview';

interface Props {
  editing: boolean;
  mode: MusicMode;
  changed: boolean;
  published?: boolean;
  storageError: string;
  saveStatus?: string;
  loading: boolean;
  canReview?: boolean;
  draft: Catalog;
  playlists: PlaylistView[];
  Cover?: ComponentType<MusicCoverProps>;
  onEditOrder: () => void;
  applyReview: () => Promise<void>;
}
/** Review visibility belongs to the current editing session; the draft remains in the document. */
export default function MusicCurationReview({
  editing,
  mode,
  changed,
  published,
  storageError,
  saveStatus,
  loading,
  canReview,
  draft,
  playlists,
  Cover,
  onEditOrder,
  applyReview,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MusicPublicationBar
        visible={editing}
        mode={mode}
        changed={changed}
        published={published}
        storageError={storageError}
        saveStatus={saveStatus}
        loading={loading}
        canReview={canReview}
        onReview={() => setOpen(true)}
      />
      <MusicReview
        open={open}
        onClose={() => setOpen(false)}
        onEditOrder={onEditOrder}
        draft={draft}
        playlists={playlists}
        Cover={Cover}
        mode={mode}
        canReview={canReview}
        applyReview={applyReview}
      />
    </>
  );
}
