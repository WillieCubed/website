'use client';
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import Icon from '@/components/icons/Icon';
import Popover from '@/components/site/Popover';

import { formatDate } from '@/lib/site/dates';
import type { DraftContent } from '@/lib/studio/types';

import type { DraftUpdate } from './writing-contracts';

interface WritingMetadataProps {
  savedRevisionId: string;
  liveRevisionId: string | null;
  showHeading: boolean;
  setShowHeading: (show: boolean) => void;
  titleField: RefObject<HTMLTextAreaElement | null>;
  body: DraftContent;
  dirty: boolean;
  status: string;
  update: (change: DraftUpdate) => void;
  published: string;
  minutes: number;
}

export default function WritingMetadata({
  savedRevisionId,
  liveRevisionId,
  showHeading,
  setShowHeading,
  titleField,
  body,
  dirty,
  status,
  update,
  published,
  minutes,
}: WritingMetadataProps) {
  const [announcement, setAnnouncement] = useState(status);
  useEffect(() => {
    if (status === 'Unsaved changes' || status === 'Saving…') return;
    const timer = setTimeout(() => setAnnouncement(status), 600);
    return () => clearTimeout(timer);
  }, [status]);
  return (
    <>
      <div className="studio-byline flex flex-wrap items-center gap-x-2 gap-y-2 text-label-large text-muted">
        <Popover
          label="Edit writing date"
          trigger={<time dateTime={published}>{formatDate(published)}</time>}
          triggerClassName="site-control studio-inline-trigger"
          panelClassName="studio-task-form"
          width={280}
        >
          <label className="site-field">
            Writing date
            <input
              type="date"
              value={published.slice(0, 10)}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  frontmatter: {
                    ...current.frontmatter,
                    published: event.target.value,
                  },
                }))
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
          {writingPublicationState(savedRevisionId, liveRevisionId, !dirty)}
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
          triggerClassName="site-control studio-tag-trigger"
          panelClassName="studio-task-form"
          width={300}
        >
          <label className="site-field">
            Tags
            <input
              value={body.tags.join(', ')}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  tags: event.target.value.split(',').map((tag) => tag.trim()),
                }))
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
  savedRevisionId: string,
  liveRevisionId: string | null,
  saved: boolean
): string {
  if (!liveRevisionId) return 'Draft';
  return liveRevisionId === savedRevisionId && saved
    ? 'Published'
    : 'Unpublished changes';
}

interface AddWritingTitleProps {
  body: DraftContent;
  showHeading: boolean;
  onAdd: () => void;
}

function AddWritingTitle({ body, showHeading, onAdd }: AddWritingTitleProps) {
  if (
    body.postType !== 'article' ||
    showHeading ||
    body.title ||
    body.description
  )
    return null;
  return (
    <button className="site-control studio-inline-trigger" onClick={onAdd}>
      Add a title
    </button>
  );
}
