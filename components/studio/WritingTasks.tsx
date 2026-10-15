'use client';
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import Button from '@/components/site/Button';

import { formatDate } from '@/lib/site/dates';
import type { Draft } from '@/lib/studio/types';
import type {
  ComponentProposal,
  DraftContent,
  Revision,
} from '@/lib/studio/types';

import StudioWidgetGenerator from './StudioWidgetGenerator';
import { studioRequest } from './api';
import type { DraftUpdate } from './writing-contracts';
import type { WritingTask } from './writing-task-definitions';
import { WRITING_TASKS } from './writing-task-definitions';
import { proseText } from './writingText';

interface WritingRevisionHistory {
  revisions: Revision[];
}

interface WritingTasksProps {
  draft: Draft;
  task: WritingTask;
  taskHeading: RefObject<HTMLHeadingElement | null>;
  body: DraftContent;
  update: (change: DraftUpdate) => void;
  returnToWriting: () => void;
  onRestore: (revision: Revision) => void;
  onApproved: (proposal: ComponentProposal) => Promise<void>;
  save: () => Promise<boolean>;
  catalogStatus?: string;
  retryCatalog?: () => void;
  reportStatus: (message: string) => void;
}

export default function WritingTasks({
  draft,
  task,
  taskHeading,
  body,
  update,
  returnToWriting,
  onRestore,
  onApproved,
  save,
  catalogStatus,
  retryCatalog,
  reportStatus,
}: WritingTasksProps) {
  const [historyLoading, setHistoryLoading] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  useEffect(() => {
    if (task !== 'history') return;
    let current = true;
    setHistoryLoading(true);
    studioRequest<Revision[] | WritingRevisionHistory>(
      `/documents/${draft.id}/revisions`
    )
      .then((result) => {
        if (current)
          setRevisions(Array.isArray(result) ? result : result.revisions);
      })
      .catch((error) => {
        if (current) reportStatus(error.message);
      })
      .finally(() => {
        if (current) setHistoryLoading(false);
      });
    return () => {
      current = false;
    };
  }, [task, draft.id, reportStatus]);
  return (
    <>
      {task !== 'write' && (
        <section className="studio-task" aria-label={WRITING_TASKS[task].label}>
          <div className="studio-task-heading">
            <h2 ref={taskHeading} tabIndex={-1} className="text-title-large">
              {WRITING_TASKS[task].heading}
            </h2>
            <Button onClick={returnToWriting}>Back to writing</Button>
          </div>
          {task === 'components' && (
            <WidgetCatalogStatus message={catalogStatus} retry={retryCatalog} />
          )}
          {task === 'details' && (
            <div className="studio-task-form">
              <label className="site-field">
                Format
                <select
                  value={body.postType}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      postType: event.target.value as DraftContent['postType'],
                    }))
                  }
                >
                  <option value="article">Article</option>
                  <option value="note">Note</option>
                </select>
              </label>
              <p className="text-body-medium text-muted">
                Articles open with a title and description. Notes begin with the
                writing itself.
              </p>
              {body.postType === 'note' && (
                <label className="site-field">
                  Private title
                  <input
                    value={body.title}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              <p className="text-body-medium break-words text-muted">
                Public address: /writings/{draft.slug}
              </p>
            </div>
          )}
          {task === 'history' && (
            <>
              <p className="text-body-medium text-muted">
                Every save keeps the previous version. Restoring one creates a
                new draft.
              </p>
              {historyLoading && <p role="status">Loading revisions…</p>}
              {!historyLoading && revisions.length === 0 && (
                <p>No earlier revisions yet.</p>
              )}
              {revisions.map((revision) => (
                <RevisionCard
                  key={revision.id}
                  revision={revision}
                  onRestore={() => onRestore(revision)}
                />
              ))}
            </>
          )}
        </section>
      )}
      <div hidden={task !== 'components'} className="studio-task-form">
        <StudioWidgetGenerator
          documentId={draft.id}
          revisionId={draft.head.id}
          save={save}
          onApproved={onApproved}
        />
      </div>
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
        <summary>
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
      <Button onClick={onRestore}>Restore as draft</Button>
    </div>
  );
}

interface WidgetCatalogStatusProps {
  message?: string;
  retry?: () => void;
}

function WidgetCatalogStatus({ message, retry }: WidgetCatalogStatusProps) {
  if (!message) return null;
  return (
    <div>
      <p role="status">{message}</p>
      {retry && <Button onClick={retry}>Retry widgets</Button>}
    </div>
  );
}
