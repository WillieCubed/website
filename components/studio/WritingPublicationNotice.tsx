import { useEffect, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';
import Button from '@/components/site/Button';

import { site } from '@/lib/site/identity';
import type { Publication } from '@/lib/studio/types';

import { studioRequest } from './api';

interface PublicationTrackingOptions {
  documentId: string;
  submittedPublication: Publication | null;
  onLive: () => Promise<void>;
}

interface WritingPublicationNoticeProps extends PublicationTrackingOptions {
  slug: string;
  busy: boolean;
  onReview: () => Promise<void>;
}

/** Publication progress survives review dismissal and subsequent document edits. */
export default function WritingPublicationNotice({
  documentId,
  slug,
  submittedPublication,
  onLive,
  busy,
  onReview,
}: WritingPublicationNoticeProps) {
  const { publication, connectionError } = usePublicationTracking({
    documentId,
    submittedPublication,
    onLive,
  });
  if (!publication)
    return connectionError ? (
      <section className="studio-notice" role="status">
        <p>{connectionError}</p>
      </section>
    ) : null;
  return (
    <section className="studio-notice" role="status">
      <h2 className="text-title-large">
        {publicationHeading(publication.status)}
      </h2>
      <p>
        {publication.error ||
          (publication.status === 'live'
            ? 'The published revision is available on your site.'
            : 'You can keep writing while this revision publishes.')}
      </p>
      {publication.pullRequestUrl && publication.status !== 'live' && (
        <SiteLink href={publication.pullRequestUrl}>
          View publication checks
        </SiteLink>
      )}
      {publication.status === 'failed' && (
        <Button disabled={busy} onClick={() => void onReview()}>
          Review and retry publication
        </Button>
      )}
      {publication.status === 'live' && (
        <SiteLink href={`${site.origin}/writings/${slug}`}>
          Read published writing →
        </SiteLink>
      )}
      {connectionError && <p>{connectionError}</p>}
    </section>
  );
}

/** One mounted notice owns adoption, retention, and polling of its active job. */
function usePublicationTracking({
  documentId,
  submittedPublication,
  onLive,
}: PublicationTrackingOptions) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [pollRetry, setPollRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setConnectionError('');
    if (submittedPublication?.documentId === documentId) {
      setPublication(submittedPublication);
      return () => controller.abort();
    }
    setPublication(null);
    try {
      const retained = sessionStorage.getItem(
        `studio-publication:${documentId}`
      );
      if (retained)
        studioRequest<Publication>(`/publications/${retained}`, { signal })
          .then((result) => {
            if (
              !signal.aborted &&
              result.documentId === documentId &&
              result.id === retained
            )
              setPublication(result);
          })
          .catch((error) => {
            if (!signal.aborted)
              setConnectionError(
                `Could not restore publication status. ${error.message}`
              );
          });
    } catch {
      /* Track submitted jobs for this visit without browser recovery storage. */
    }
    return () => controller.abort();
  }, [submittedPublication, documentId]);
  useEffect(() => {
    if (!publication || publication.documentId !== documentId) return;
    try {
      sessionStorage.setItem(
        `studio-publication:${documentId}`,
        publication.id
      );
    } catch {
      /* The active job remains available for this visit. */
    }
  }, [publication, documentId]);
  useEffect(() => {
    if (
      !publication ||
      publication.documentId !== documentId ||
      ['live', 'failed'].includes(publication.status)
    )
      return;
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(() => {
      studioRequest<Publication>(`/publications/${publication.id}`, { signal })
        .then((result) => {
          if (
            !signal.aborted &&
            result.documentId === documentId &&
            result.id === publication.id
          ) {
            setPublication(result);
            setConnectionError('');
          }
        })
        .catch((error) => {
          if (signal.aborted) return;
          setConnectionError(
            `Connection interrupted. Retrying… ${error.message}`
          );
          setPollRetry((value) => value + 1);
        });
    }, 2500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [publication, documentId, pollRetry, submittedPublication]);
  useEffect(() => {
    if (publication?.documentId === documentId && publication.status === 'live')
      void onLive();
  }, [publication?.id, publication?.status, documentId, onLive]);
  return {
    publication: publication?.documentId === documentId ? publication : null,
    connectionError,
  };
}

function publicationHeading(status: string): string {
  const headings: Record<string, string> = {
    live: 'Your writing is live',
    failed: 'Publication needs attention',
    deploying: 'Deploying your writing…',
  };
  return headings[status] ?? 'Publishing your revision…';
}
