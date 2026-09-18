'use client';

import { useState } from 'react';

import type { Reference } from '@/lib/writings/references';

import './references.css';

const CONDENSED_COUNT = 3;

/**
 * Every reference in the page, numbered as in the text. With more than a
 * few, the list condenses to its first entries and a button unfolds the
 * rest; it never hides entirely.
 */
export function References({ items }: { items: Reference[] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const condensable = items.length > CONDENSED_COUNT + 1;
  const shown =
    condensable && !expanded ? items.slice(0, CONDENSED_COUNT) : items;
  const hidden = items.length - shown.length;

  return (
    <section className="references" aria-label="References">
      <ol>
        {shown.map((item) => (
          <li key={item.id} id={`ref-${item.id}`}>
            <span className="references__num">{item.index}</span>
            <span>
              {item.kind === 'link' && item.href ? (
                <a href={item.href} rel="noopener" className="link-animated">
                  {item.content}
                </a>
              ) : (
                item.content
              )}
              {item.kind === 'link' && item.href && (
                <span className="ref-popover__host">{host(item.href)}</span>
              )}
            </span>
            <a
              href={`#ref-mark-${item.id}`}
              className="references__back"
              aria-label={`Back to reference ${item.index} in the text`}
            >
              ↩
            </a>
          </li>
        ))}
      </ol>
      {condensable && (
        <button
          type="button"
          className="references__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Fewer' : `${hidden} more`}
        </button>
      )}
    </section>
  );
}

function host(href: string): string {
  try {
    return new URL(href, 'https://willie.page').hostname;
  } catch {
    return '';
  }
}

export default References;
