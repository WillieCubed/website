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
}
export function useMusicPublication({ readDraft, busy, setBusy }: Options) {
  const [error, setError] = useState('');
  const [publication, setPublication] = useState<MusicPublication | null>(null);
  const [showPublicationNotice, setShowPublicationNotice] = useState(false);
  const pollFailures = useRef(0);
  // Staging invalidates responses before React runs the effect cleanup.
  const pollGeneration = useRef(0);
  function acceptPublication(value: MusicPublication | null) {
    pollGeneration.current++;
    pollFailures.current = 0;
    setError('');
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
    let active = true;
    const generation = pollGeneration.current;
    const timer = setTimeout(
      () => {
        musicAdminRequest<MusicPublication>(`/publications/${publication.id}`)
          .then((result) => {
            if (!active || generation !== pollGeneration.current) return;
            pollFailures.current = 0;
            setError('');
            setPublication(result);
          })
          .catch((e) => {
            if (!active || generation !== pollGeneration.current) return;
            pollFailures.current++;
            setError(e.message);
            setPublication((current) => (current ? { ...current } : null));
          });
      },
      Math.min(60000, 5000 * 2 ** pollFailures.current)
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [publication]);
  return {
    error,
    dismissError: () => setError(''),
    publication,
    showPublicationNotice,
    publish,
    acceptPublication,
    clearPublication: () => acceptPublication(null),
    dismissNotice: () => setShowPublicationNotice(false),
  };
}
