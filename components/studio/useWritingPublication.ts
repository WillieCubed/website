'use client';

import { useEffect, useState } from 'react';

import type { Publication, Revision } from '@/lib/studio/types';

import { studioRequest } from './api';
import type { WritingDocument, WritingSnapshot } from './writing-contracts';

export interface WritingPreview {
  html: string;
  contentHtml: string;
  portableHtml: string;
  portableText: string;
  issues: unknown[];
}
interface PreparedPreview {
  snapshot: WritingSnapshot;
  preview: WritingPreview;
  revision: Revision | null;
}

export interface WritingPublication {
  preparePreview: (publishing?: boolean) => Promise<boolean>;
  dismissReview: () => void;
  publish: () => Promise<void>;
  preview: WritingPreview | null;
  review: boolean;
  reviewedRevision: number | null;
  busy: boolean;
  publication: Publication | null;
  publicationConnectionError: string;
}

/** Prepare immutable review data; editor navigation belongs to interaction. */
export function useWritingPublication(
  document: WritingDocument
): WritingPublication {
  const documentId = document.draft.id;
  const { reportStatus, refreshPublicationMetadata } = document;
  const [prepared, setPrepared] = useState<PreparedPreview | null>(null);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [publicationConnectionError, setPublicationConnectionError] =
    useState('');
  const [publicationPollRetry, setPublicationPollRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // An edit retires authority even when undo restores identical bytes.
    setPrepared(null);
  }, [document.body]);
  useEffect(() => {
    try {
      const retained = sessionStorage.getItem(
        `studio-publication:${documentId}`
      );
      if (retained)
        studioRequest<Publication>(`/publications/${retained}`)
          .then(setPublication)
          .catch((error) => reportStatus(error.message));
    } catch {
      /* Saved writing remains available without browser recovery storage. */
    }
  }, [documentId, reportStatus]);
  useEffect(() => {
    if (!publication) return;
    try {
      sessionStorage.setItem(
        `studio-publication:${documentId}`,
        publication.id
      );
    } catch {
      /* Poll the publication for this visit. */
    }
  }, [publication, documentId]);
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
    if (publication?.status === 'live') void refreshPublicationMetadata();
  }, [publication?.status, refreshPublicationMetadata]);

  async function preparePreview(publishing = false): Promise<boolean> {
    const snapshot = document.captureSnapshot();
    setBusy(true);
    try {
      const revision = publishing
        ? await document.selectSavedRevision(snapshot)
        : null;
      if (publishing && !revision) return false;
      const preview = await studioRequest<WritingPreview>('/preview', {
        method: 'POST',
        body: JSON.stringify({
          body: snapshot.body,
          slug: document.draft.slug,
        }),
      });
      if (!document.isCurrent(snapshot)) {
        reportStatus(
          'Your writing changed while the preview loaded. Review it again.'
        );
        return false;
      }
      setPrepared({ snapshot, preview, revision });
      return true;
    } catch (error) {
      reportStatus((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function dismissReview() {
    setPrepared((current) => (current ? { ...current, revision: null } : null));
  }
  async function publish() {
    if (!prepared?.revision || !document.isCurrent(prepared.snapshot)) {
      dismissReview();
      reportStatus(
        'Your writing changed. Review the current draft before publishing.'
      );
      return;
    }
    setBusy(true);
    try {
      if (!(await document.save())) {
        reportStatus('Save your changes before publishing.');
        return;
      }
      if (!document.isCurrent(prepared.snapshot)) {
        dismissReview();
        reportStatus('Your writing changed during saving. Review it again.');
        return;
      }
      const next = await studioRequest<Publication>('/publications', {
        method: 'POST',
        body: JSON.stringify({ documentId, revisionId: prepared.revision.id }),
      });
      setPublication(next);
      dismissReview();
    } catch (error) {
      reportStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const current =
    prepared && document.isCurrent(prepared.snapshot) ? prepared : null;
  return {
    preparePreview,
    dismissReview,
    publish,
    preview: current?.preview ?? null,
    review: Boolean(current?.revision),
    reviewedRevision: current?.revision?.number ?? null,
    busy,
    publication,
    publicationConnectionError,
  };
}
