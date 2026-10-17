'use client';
import { useEffect, useRef } from 'react';

import Button from '@/components/site/Button';

import { formatDate } from '@/lib/site/dates';
import type { Draft, DraftContent } from '@/lib/studio/types';

import StudioPreview from './StudioPreview';
import type { WritingPreview } from './useWritingPublication';
import type { WritingMode, WritingPreviewMode } from './writing-contracts';

interface WritingReviewProps {
  draft: Draft;
  reviewedRevision: number | null;
  body: DraftContent;
  status: string;
  conflict: boolean;
  mode: WritingMode;
  onViewChange: (mode: WritingPreviewMode) => void;
  preview: WritingPreview | null;
  review: boolean;
  busy: boolean;
  returnToWriting: () => void;
  publish: () => Promise<void>;
  published: string;
  minutes: number;
}

export default function WritingReview({
  draft,
  reviewedRevision,
  body,
  status,
  conflict,
  mode,
  onViewChange,
  preview,
  review,
  busy,
  returnToWriting,
  publish,
  published,
  minutes,
}: WritingReviewProps) {
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    reviewHeading.current?.focus();
  }, []);
  return (
    <>
      <section className="studio-review-screen pt-10">
        <p
          role="status"
          aria-live="polite"
          className="text-label-large text-muted mb-4"
        >
          {status}
        </p>
        <div className="studio-task-heading">
          <h1
            ref={reviewHeading}
            tabIndex={-1}
            className="text-headline-medium"
          >
            {review ? 'Review publication' : 'Read your writing'}
          </h1>
          <Button variant="quiet" size="small" onClick={returnToWriting}>
            Back to writing
          </Button>
        </div>
        <p className="mt-4 text-body-large text-muted">
          {review
            ? `This revision will appear at /writings/${draft.slug}. Website and portable versions are available below.`
            : 'A preview of the current draft.'}
        </p>
        {review && (
          <p className="mt-3 text-label-large text-muted">
            Saved revision {reviewedRevision}
          </p>
        )}
        <nav className="studio-preview-tabs" aria-label="Writing view">
          {(['read', 'portable'] as const).map((item) => (
            <Button
              key={item}
              variant="quiet"
              size="small"
              aria-pressed={mode === item}
              onClick={() => onViewChange(item)}
            >
              {item === 'read' ? 'Read' : 'Portable preview'}
            </Button>
          ))}
        </nav>
        {preview && (
          <>
            {mode === 'read' ? (
              <ReviewArticle
                body={body}
                preview={preview}
                published={published}
                minutes={minutes}
              />
            ) : (
              <StudioPreview
                title="Portable writing preview"
                html={preview.portableHtml}
              />
            )}
            {mode === 'portable' && (
              <details className="mt-4">
                <summary className="site-control studio-disclosure">
                  Plain text version
                </summary>
                <pre>{preview.portableText}</pre>
              </details>
            )}
          </>
        )}
        {review && preview && (
          <PublicationChecks
            preview={preview}
            busy={busy}
            conflict={conflict}
            publish={publish}
          />
        )}
      </section>
    </>
  );
}

interface ReviewArticleProps {
  body: DraftContent;
  published: string;
  minutes: number;
  preview: WritingPreview;
}

function ReviewArticle({
  body,
  preview,
  published,
  minutes,
}: ReviewArticleProps) {
  return (
    <article>
      <header className="pb-10 pt-4">
        {body.postType === 'article' && (
          <div className="space-y-2">
            <h2 className="text-headline-medium desktop:text-headline-large">
              {body.title}
            </h2>
            <p className="text-body-large text-accent">{body.description}</p>
          </div>
        )}
        <p className="mt-5 text-label-large text-muted">
          <time dateTime={published}>{formatDate(published)}</time>
          {body.postType === 'article' && <> · {minutes} min read</>}
        </p>
      </header>
      <div
        className={`prose prose-theme max-w-none ${body.postType === 'note' ? 'prose-xl [&_p]:text-body-large' : 'prose-lg [&_p]:text-body-medium'} [&_p]:my-4 [&_p]:leading-relaxed [&_p]:text-on-surface`}
        dangerouslySetInnerHTML={{
          __html: preview.contentHtml,
        }}
      />
      {body.tags.filter(Boolean).length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
          {body.tags.filter(Boolean).map((tag) => (
            <li key={tag}>
              <span className="inline-block rounded-full border border-line bg-ground px-3 py-1 text-label-medium text-ink">
                {tag}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

interface PublicationChecksProps {
  busy: boolean;
  conflict: boolean;
  publish: () => Promise<void>;
  preview: WritingPreview;
}

function PublicationChecks({
  preview,
  busy,
  conflict,
  publish,
}: PublicationChecksProps) {
  return (
    <section className="studio-review mt-8">
      <h2 className="text-title-large">Publication checks</h2>
      {preview.issues.length > 0 ? (
        <>
          <p>Resolve these issues first:</p>
          <ul>
            {preview.issues.map((issue, index) => (
              <li key={index}>
                {typeof issue === 'string' ? issue : JSON.stringify(issue)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>No preview validation issues.</p>
      )}
      <Button
        variant="primary"
        size="small"
        disabled={busy || preview.issues.length > 0 || conflict}
        onClick={publish}
      >
        Publish this revision
      </Button>
    </section>
  );
}
