import { useEffect, useState } from 'react';

import Button from '@/components/site/Button';

import { formatDate } from '@/lib/site/dates';
import type { Revision } from '@/lib/studio/types';

import { studioRequest } from './api';
import { proseText } from './writingText';

interface WritingRevisionHistory {
  revisions: Revision[];
}

interface WritingHistoryProps {
  documentId: string;
  onRestore: (revision: Revision) => void;
}

/** History requests and failures live only as long as the history task. */
export default function WritingHistory({
  documentId,
  onRestore,
}: WritingHistoryProps) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setRevisions(null);
    setError('');
    studioRequest<Revision[] | WritingRevisionHistory>(
      `/documents/${documentId}/revisions`,
      { signal }
    )
      .then((result) => {
        if (!signal.aborted)
          setRevisions(Array.isArray(result) ? result : result.revisions);
      })
      .catch((failure) => {
        if (!signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [documentId, attempt]);
  return (
    <>
      <p className="text-body-medium text-muted">
        Every save keeps the previous version. Restoring one creates a new
        draft.
      </p>
      {error && (
        <div>
          <p role="alert">{error}</p>
          <Button
            variant="quiet"
            size="small"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry history
          </Button>
        </div>
      )}
      {!error && revisions === null && <p role="status">Loading revisions…</p>}
      {revisions?.length === 0 && <p>No earlier revisions yet.</p>}
      {revisions?.map((revision) => (
        <RevisionCard
          key={revision.id}
          revision={revision}
          onRestore={() => onRestore(revision)}
        />
      ))}
    </>
  );
}

interface RevisionCardProps {
  revision: Revision;
  onRestore: () => void;
}

function RevisionCard({ revision, onRestore }: RevisionCardProps) {
  return (
    <div className="studio-revision">
      <details className="studio-history-inspection">
        <summary className="site-control studio-disclosure">
          Revision {revision.number} · {formatDate(revision.createdAt)}
        </summary>
        {revision.body.title && (
          <h3 className="mt-4 text-title-medium">{revision.body.title}</h3>
        )}
        {revision.body.description && (
          <p className="mt-2 text-body-medium text-muted">
            {revision.body.description}
          </p>
        )}
        <p className="mt-4 whitespace-pre-wrap text-body-medium">
          {proseText(revision.body.document)}
        </p>
        {revision.body.originalSource && (
          <p className="mt-2 text-body-small text-muted">
            Imported source is retained in this revision.
          </p>
        )}
      </details>
      <Button variant="outlined" size="small" onClick={onRestore}>
        Restore as draft
      </Button>
    </div>
  );
}
