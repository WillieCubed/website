'use client';

import Icon from '@/components/icons/Icon';
import Popover from '@/components/site/Popover';

import { formatDate } from '@/lib/site/dates';

import type { WritingController } from './useWritingController';

export default function WritingMetadata({
  controller,
}: {
  controller: Pick<
    WritingController,
    | 'draft'
    | 'showHeading'
    | 'setShowHeading'
    | 'announcement'
    | 'titleField'
    | 'body'
    | 'bodyRef'
    | 'saved'
    | 'status'
    | 'update'
    | 'published'
    | 'minutes'
  >;
}) {
  const {
    draft,
    showHeading,
    setShowHeading,
    announcement,
    titleField,
    body,
    bodyRef,
    saved,
    status,
    update,
    published,
    minutes,
  } = controller;
  return (
    <>
      <div className="studio-byline flex flex-wrap items-center gap-x-2 gap-y-2 text-label-large text-muted">
        <Popover
          label="Edit writing date"
          trigger={<time dateTime={published}>{formatDate(published)}</time>}
          triggerClassName="studio-inline-trigger"
          panelClassName="studio-task-form"
          width={280}
        >
          <label className="site-field">
            Writing date
            <input
              type="date"
              value={published.slice(0, 10)}
              onChange={(event) =>
                update({
                  ...bodyRef.current,
                  frontmatter: {
                    ...bodyRef.current.frontmatter,
                    published: event.target.value,
                  },
                })
              }
            />
          </label>
        </Popover>
        {body.postType === 'article' && minutes > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>{minutes} min read</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>
          {writingPublicationState(
            draft,
            JSON.stringify(body) === saved.current
          )}
        </span>
        <AddWritingTitle
          body={body}
          showHeading={showHeading}
          onAdd={() => {
            setShowHeading(true);
            requestAnimationFrame(() => titleField.current?.focus());
          }}
        />
        <div
          className={`studio-editor-context text-label-large text-muted${['All changes saved', 'Unsaved changes', 'Saving…'].includes(status) ? '' : ' studio-editor-context-expanded'}`}
        >
          <span aria-hidden="true">·</span>
          <div role="status" aria-live="off" className="studio-save-state">
            <span aria-hidden="true">
              {status === 'All changes saved'
                ? 'Saved'
                : status === 'Unsaved changes'
                  ? 'Editing'
                  : status}
            </span>
            <span className="sr-only">{status}</span>
          </div>
          <span className="sr-only" aria-live="polite">
            {announcement}
          </span>
        </div>
      </div>
      <div className="studio-tags">
        <Popover
          label="Edit tags"
          trigger={
            <>
              <Icon name="tag" size={18} />
              <span>{body.tags.filter(Boolean).join(', ') || 'Add tags'}</span>
            </>
          }
          triggerClassName="studio-tag-trigger"
          panelClassName="studio-task-form"
          width={300}
        >
          <label className="site-field">
            Tags
            <input
              value={body.tags.join(', ')}
              onChange={(event) =>
                update({
                  ...bodyRef.current,
                  tags: event.target.value.split(',').map((tag) => tag.trim()),
                })
              }
              placeholder="Ideas, places, projects"
            />
          </label>
          <p className="text-body-small text-muted">
            Separate tags with commas.
          </p>
        </Popover>
      </div>
    </>
  );
}

function writingPublicationState(
  draft: WritingController['draft'],
  saved: boolean
): string {
  if (!draft.liveRevisionId) return 'Draft';
  return draft.liveRevisionId === draft.head.id && saved
    ? 'Published'
    : 'Unpublished changes';
}

function AddWritingTitle({
  body,
  showHeading,
  onAdd,
}: {
  body: WritingController['body'];
  showHeading: boolean;
  onAdd: () => void;
}) {
  if (
    body.postType !== 'article' ||
    showHeading ||
    body.title ||
    body.description
  )
    return null;
  return (
    <button className="studio-inline-trigger" onClick={onAdd}>
      Add a title
    </button>
  );
}
