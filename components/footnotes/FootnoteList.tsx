'use client';

import type { ExtractedFootnote } from '@/lib/writings/remark-sidenotes';

interface FootnoteListProps {
  footnotes: ExtractedFootnote[];
  className?: string;
}

/**
 * Footnotes list that appears at the bottom of the article.
 * Each footnote has a back-link to its reference in the content.
 */
export function FootnoteList({ footnotes, className = '' }: FootnoteListProps) {
  if (footnotes.length === 0) {
    return null;
  }

  const handleBackClick = (id: string) => {
    const refElement = document.getElementById(`fnref-${id}`);
    if (refElement) {
      refElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      refElement.focus();
    }
  };

  return (
    <section
      className={`border-t border-gray-200 dark:border-gray-700 pt-6 ${className}`}
      aria-labelledby="footnotes-heading"
    >
      <h2
        id="footnotes-heading"
        className="text-title-medium font-medium text-gray-700 dark:text-gray-300 mb-4"
      >
        Footnotes
      </h2>
      <ol className="space-y-3 list-none pl-0">
        {footnotes.map((footnote) => (
          <li
            key={footnote.id}
            id={`footnote-${footnote.id}`}
            className="
              text-body-small text-gray-600 dark:text-gray-400
              pl-6 relative
            "
            tabIndex={-1}
          >
            <span className="absolute left-0 text-label-small font-medium text-gray-500 dark:text-gray-500">
              {footnote.index}.
            </span>
            <span>{footnote.content}</span>
            <button
              type="button"
              onClick={() => handleBackClick(footnote.id)}
              className="
                ml-2 inline-flex items-center
                text-primary hover:text-primary-dark
                text-label-small
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
              "
              aria-label={`Back to reference ${footnote.index}`}
            >
              ↩
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default FootnoteList;
