'use client';
import { useEffect, useRef, useState } from 'react';

import type { MusicCatalog, MusicPublication } from '@/lib/music/types';

import { musicAdminRequest } from './music-admin-request';
import {
  type MusicDraftSnapshot,
  canPublishMusic,
  isReviewedMusic,
} from './music-draft-guards';

interface Options {
  readDraft: () => MusicDraftSnapshot;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setError: (message: string) => void;
}
export function useMusicPublication({
  readDraft,
  busy,
  setBusy,
  setError,
}: Options) {
  const [publication, setPublication] = useState<MusicPublication | null>(null);
  const [showPublicationNotice, setShowPublicationNotice] = useState(false);
  const pollFailures = useRef(0);
  function acceptPublication(value: MusicPublication | null) {
    setPublication(value);
    setShowPublicationNotice(Boolean(value && value.status !== 'live'));
  }
  async function publish(reviewed: MusicCatalog) {
    const draft = readDraft();
    if (!canPublishMusic(draft, busy)) return;
    if (!isReviewedMusic(draft, reviewed)) {
      setError(
        'The draft changed after review. Review the saved version again.'
      );
      return;
    }
    const revisionId = draft.revisionId;
    setBusy(true);
    setError('');
    try {
      const result = await musicAdminRequest<MusicPublication>(
        '/publications',
        {
          method: 'POST',
          body: JSON.stringify({ revisionId }),
        }
      );
      setPublication(result);
      setShowPublicationNotice(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !publication ||
      !['publishing', 'deploying'].includes(publication.status)
    )
      return;
    const timer = setTimeout(
      () => {
        musicAdminRequest<MusicPublication>(`/publications/${publication.id}`)
          .then((result) => {
            pollFailures.current = 0;
            setError('');
            setPublication(result);
          })
          .catch((e) => {
            pollFailures.current++;
            setError(e.message);
            setPublication((current) => (current ? { ...current } : null));
          });
      },
      Math.min(60000, 5000 * 2 ** pollFailures.current)
    );
    return () => clearTimeout(timer);
  }, [publication]);
  return {
    publication,
    showPublicationNotice,
    publish,
    acceptPublication,
    clearPublication: () => setPublication(null),
    dismissNotice: () => setShowPublicationNotice(false),
  };
}
