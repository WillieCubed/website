'use client';
import { useState } from 'react';

import type {
  MusicAdminCollectionData,
  MusicCatalog,
  MusicRevision,
} from '@/lib/music/types';

/** The editor's loaded data and the moments that replace its local session. */
export function useMusicCollection() {
  const [data, setData] = useState<MusicAdminCollectionData | null>(null);
  const [generation, setGeneration] = useState(0);
  const [editorCatalog, setEditorCatalog] = useState<MusicCatalog | null>(null);

  function accept(catalog: MusicAdminCollectionData) {
    setData(catalog);
    setEditorCatalog(null);
  }
  function acceptRevision(revision: MusicRevision) {
    setData((current) => (current ? { ...current, revision } : current));
  }
  function remount() {
    setGeneration((current) => current + 1);
  }
  function recover(catalog: MusicCatalog) {
    setEditorCatalog(catalog);
    remount();
  }
  return {
    data,
    generation,
    editorCatalog,
    accept,
    acceptRevision,
    recover,
    remount,
  };
}
