import type { RefObject } from 'react';

import Button from '@/components/site/Button';

import type { Draft } from '@/lib/studio/types';
import type {
  ComponentProposal,
  DraftContent,
  Revision,
} from '@/lib/studio/types';

import StudioWidgetGenerator from './StudioWidgetGenerator';
import WritingHistory from './WritingHistory';
import type { DraftUpdate } from './writing-contracts';
import type { WritingTask } from './writing-task-definitions';
import { WRITING_TASKS } from './writing-task-definitions';

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
}: WritingTasksProps) {
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
            <WritingHistory documentId={draft.id} onRestore={onRestore} />
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
