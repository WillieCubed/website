'use client';
import type { RefObject } from 'react';
import { useId } from 'react';

import type { DraftContent } from '@/lib/studio/types';

import { StudioHeadingFields } from './StudioWritingLayout';

export default function WritingHeading({
  showHeading,
  titleField,
  body,
  bodyRef,
  update,
}: {
  showHeading: boolean;
  titleField: RefObject<HTMLTextAreaElement | null>;
  body: DraftContent;
  bodyRef: RefObject<DraftContent>;
  update: (body: DraftContent) => void;
}) {
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const descriptionId = `${fieldId}-description`;

  return (
    <>
      <h1 className="sr-only">{body.title || 'Untitled writing'}</h1>
      {body.postType === 'article' &&
        (showHeading || body.title || body.description) && (
          <StudioHeadingFields>
            <div className="studio-heading-field">
              <label className="sr-only" htmlFor={titleId}>
                Title
              </label>
              <textarea
                ref={titleField}
                id={titleId}
                rows={1}
                className="studio-inline-title text-headline-medium desktop:text-headline-large"
                value={body.title}
                placeholder="Untitled writing"
                onChange={(event) =>
                  update({
                    ...bodyRef.current,
                    title: event.target.value.replace(/\n/g, ' '),
                  })
                }
              />
            </div>
            <div className="studio-heading-field">
              <label className="sr-only" htmlFor={descriptionId}>
                Description
              </label>
              <textarea
                id={descriptionId}
                rows={1}
                className="studio-inline-summary text-body-large text-accent"
                value={body.description}
                placeholder="Add a description"
                onChange={(event) =>
                  update({
                    ...bodyRef.current,
                    description: event.target.value,
                  })
                }
              />
            </div>
          </StudioHeadingFields>
        )}
    </>
  );
}
