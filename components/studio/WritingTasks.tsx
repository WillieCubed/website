'use client';

import Button from '@/components/site/Button';

import { formatDate } from '@/lib/site/dates';
import type { DraftContent, Revision } from '@/lib/studio/types';

import { type CatalogEntry } from './StudioNodes';
import StudioWidgetGenerator from './StudioWidgetGenerator';
import { studioRequest } from './api';
import type { WritingController } from './useWritingController';
import { WRITING_TASKS } from './writing-task-definitions';
import { proseText } from './writingText';

export default function WritingTasks({
  controller,
  catalogStatus,
  retryCatalog,
}: {
  controller: Pick<
    WritingController,
    | 'draft'
    | 'setCatalog'
    | 'catalogRef'
    | 'task'
    | 'taskHeading'
    | 'historyLoading'
    | 'body'
    | 'bodyRef'
    | 'revisions'
    | 'update'
    | 'editor'
    | 'returnToWriting'
    | 'insert'
    | 'save'
  >;
  catalogStatus?: string;
  retryCatalog?: () => void;
}) {
  const {
    draft,
    setCatalog,
    catalogRef,
    task,
    taskHeading,
    historyLoading,
    body,
    bodyRef,
    revisions,
    update,
    editor,
    returnToWriting,
    insert,
    save,
  } = controller;
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
                    update({
                      ...bodyRef.current,
                      postType: event.target.value as DraftContent['postType'],
                    })
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
                      update({
                        ...bodyRef.current,
                        title: event.target.value,
                      })
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
                  onRestore={() => {
                    editor?.commands.setContent(revision.body.document);
                    update(revision.body);
                    returnToWriting();
                  }}
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
          onApproved={async (proposal) => {
            const result = await studioRequest<{
              entries: CatalogEntry[];
            }>('/catalog');
            catalogRef.current = result.entries;
            setCatalog(result.entries);
            const entry = result.entries.find(
              (item) =>
                item.id === proposal.id && item.version === proposal.version
            );
            if (entry) insert(entry);
          }}
        />
      </div>
    </>
  );
}

function RevisionCard({
  revision,
  onRestore,
}: {
  revision: Revision;
  onRestore: () => void;
}) {
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

function WidgetCatalogStatus({
  message,
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  if (!message) return null;
  return (
    <div>
      <p role="status">{message}</p>
      {retry && <Button onClick={retry}>Retry widgets</Button>}
    </div>
  );
}
