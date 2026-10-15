'use client';

import { useEffect, useRef, useState } from 'react';

import type { Draft, Publication } from '@/lib/studio/types';

import { studioRequest } from './api';
import type { WritingDocument } from './writing-contracts';

export type WritingPreview = {
  html: string;
  contentHtml: string;
  portableHtml: string;
  portableText: string;
  issues: unknown[];
};

/** Review and publish an immutable saved revision while the working document stays editable. */
export function useWritingPublication(
  document: WritingDocument,
  initial: Draft,
  rememberRange: () => void
) {
  const { draft, setDraft, bodyRef, headRef, setStatus, save } = document;
  const [publicationConnectionError, setPublicationConnectionError] =
    useState('');
  const [publicationPollRetry, setPublicationPollRetry] = useState(0);
  const [reviewedRevision, setReviewedRevision] = useState<number | null>(null);
  const reviewedBody = useRef<string | null>(null);
  const reviewedRevisionId = useRef<string | null>(null);
  const [mode, setMode] = useState<'write' | 'read' | 'portable'>('write');
  const [preview, setPreview] = useState<WritingPreview | null>(null);
  const [review, setReview] = useState(false);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const currentSnapshot = JSON.stringify(document.body);
  useEffect(() => {
    // An edit retires review authorization even when a later undo restores its bytes.
    reviewedBody.current = null;
    reviewedRevisionId.current = null;
    setPreview(null);
    setPreviewBody(null);
    setReview(false);
  }, [document.body]);
  useEffect(() => {
    try {
      const retained = sessionStorage.getItem(
        `studio-publication:${initial.id}`
      );
      if (retained)
        studioRequest<Publication>(`/publications/${retained}`)
          .then(setPublication)
          .catch((error) => setStatus(error.message));
    } catch {
      /* Saved writing remains available without browser recovery storage. */
    }
  }, [initial.id]);
  useEffect(() => {
    if (publication) {
      try {
        sessionStorage.setItem(
          `studio-publication:${initial.id}`,
          publication.id
        );
      } catch {
        /* Poll the publication for this visit. */
      }
    }
  }, [publication, initial.id]);
  useEffect(() => {
    if (!publication || ['live', 'failed'].includes(publication.status)) return;
    const timer = setTimeout(() => {
      studioRequest<Publication>(`/publications/${publication.id}`)
        .then((value) => {
          setPublication(value);
          setPublicationConnectionError('');
        })
        .catch((error) => {
          setPublicationConnectionError(
            `Connection interrupted. Retrying… ${error.message}`
          );
          setPublicationPollRetry((value) => value + 1);
        });
    }, 2500);
    return () => clearTimeout(timer);
  }, [publication, publicationPollRetry]);
  useEffect(() => {
    if (publication?.status === 'live')
      studioRequest<Draft>(`/documents/${initial.id}`)
        .then(setDraft)
        .catch((error) => setStatus(error.message));
  }, [publication?.status, initial.id]);
  async function selectPublicationRevision(snapshot: string): Promise<boolean> {
    if (!(await save())) {
      setStatus('Save your changes before reviewing publication.');
      return false;
    }
    if (snapshot !== JSON.stringify(bodyRef.current)) {
      setStatus('Your writing changed. Review it again.');
      return false;
    }
    try {
      const current = await studioRequest<Draft>(`/documents/${draft.id}`);
      if (snapshot !== JSON.stringify(bodyRef.current)) {
        setStatus('Your writing changed. Review it again.');
        return false;
      }
      if (current.head.id !== headRef.current) {
        setStatus(
          'A newer revision exists. Load it before reviewing publication.'
        );
        return false;
      }
      setReviewedRevision(current.head.number);
      reviewedRevisionId.current = current.head.id;
    } catch (error) {
      setStatus((error as Error).message);
      return false;
    }

    return true;
  }
  async function generatePreview(
    nextMode: 'read' | 'portable',
    publishing = false
  ) {
    rememberRange();
    const snapshot = JSON.stringify(bodyRef.current);
    setBusy(true);
    if (publishing && !(await selectPublicationRevision(snapshot))) {
      setBusy(false);
      return;
    }
    try {
      const next = await studioRequest<WritingPreview>('/preview', {
        method: 'POST',
        body: JSON.stringify({ body: JSON.parse(snapshot), slug: draft.slug }),
      });
      if (snapshot !== JSON.stringify(bodyRef.current)) {
        setStatus(
          'Your writing changed while the preview loaded. Review it again.'
        );
        return;
      }
      reviewedBody.current = publishing ? snapshot : null;
      setPreviewBody(snapshot);
      setPreview(next);
      setMode(nextMode);
      setReview(publishing);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (
      !reviewedBody.current ||
      !reviewedRevisionId.current ||
      reviewedBody.current !== JSON.stringify(bodyRef.current)
    ) {
      setReview(false);
      setStatus(
        'Your writing changed. Review the current draft before publishing.'
      );
      return;
    }
    setBusy(true);
    try {
      if (!(await save())) {
        setStatus('Save your changes before publishing.');
        return;
      }
      if (reviewedBody.current !== JSON.stringify(bodyRef.current)) {
        setReview(false);
        setStatus('Your writing changed during saving. Review it again.');
        return;
      }
      const next = await studioRequest<Publication>('/publications', {
        method: 'POST',
        body: JSON.stringify({
          documentId: draft.id,
          revisionId: reviewedRevisionId.current,
        }),
      });
      setPublication(next);
      setReview(false);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    generatePreview,
    publish,
    mode,
    setMode,
    preview: previewBody === currentSnapshot ? preview : null,
    review: previewBody === currentSnapshot && review,
    setReview,
    busy,
    reviewedRevision,
    publication,
    publicationConnectionError,
  };
}
