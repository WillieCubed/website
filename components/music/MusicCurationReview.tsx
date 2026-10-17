'use client';
import { useState } from 'react';

import type { Catalog, PlaylistView } from '@/lib/music/presentation';

import MusicPublicationBar from './MusicPublicationBar';
import MusicReview from './MusicReview';

interface Props {
  editing: boolean;
  changed: boolean;
  published?: boolean;
  saveStatus?: string;
  loading: boolean;
  canReview?: boolean;
  draft: Catalog;
  playlists: PlaylistView[];
  onEditOrder: () => void;
  applyReview: () => Promise<void>;
}
/** Review visibility belongs to the current editing session; the draft remains in the document. */
export default function MusicCurationReview({
  editing,
  changed,
  published,
  saveStatus,
  loading,
  canReview,
  draft,
  playlists,
  onEditOrder,
  applyReview,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MusicPublicationBar
        visible={editing}
        changed={changed}
        published={published}
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
        canReview={canReview}
        applyReview={applyReview}
      />
    </>
  );
}
