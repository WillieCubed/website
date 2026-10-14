'use client';

import { useId } from 'react';

import { StudioHeadingFields } from './StudioWritingLayout';
import type { WritingController } from './useWritingController';

export default function WritingHeading({
  controller,
}: {
  controller: Pick<
    WritingController,
    'showHeading' | 'titleField' | 'body' | 'bodyRef' | 'update'
  >;
}) {
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const descriptionId = `${fieldId}-description`;
  const { showHeading, titleField, body, bodyRef, update } = controller;
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
