import Link from 'next/link';

import type { Initiative, Part } from '@/lib/initiatives';

import Reveal from './Reveal';
import { formatDay, formatRange, isoDate } from './dates';

interface PlaybillProps {
  initiative: Initiative;
  /** `compact` fits inside a homepage tile; `full` is the initiative page. */
  variant?: 'full' | 'compact';
}

const STATUS_LABEL: Record<Part['status'], string> = {
  planned: 'Opens',
  active: 'Now playing',
  paused: 'Paused',
  complete: 'Wrapped',
  archived: 'Archived',
};

/**
 * The acts of a campaign, in order. Every act is fully rendered on the
 * server; the reveal is only an entrance, never a gate, so nothing here is
 * hidden behind a hover or a scroll position.
 */
export default function Playbill({
  initiative,
  variant = 'full',
}: PlaybillProps) {
  const { parts, partLabel } = initiative;
  if (parts.length === 0) return null;
  const compact = variant === 'compact';

  return (
    <Reveal>
      <ol
        className={
          compact
            ? 'grid gap-2'
            : 'grid gap-4 medium:grid-cols-2 large:grid-cols-4'
        }
        aria-label={`${initiative.title} acts`}
      >
        {parts.map((part) => {
          const href = `${initiative.href}/${part.slug}`;
          const status = STATUS_LABEL[part.status];
          const when =
            part.status === 'planned'
              ? `${status} ${formatDay(part.starts)}`
              : status;
          return (
            <li
              key={part.slug}
              className="act"
              aria-current={part.status === 'active' ? 'step' : undefined}
            >
              <article
                className={`act-card relative flex h-full flex-col rounded-2xl ${compact ? 'p-3' : 'p-5'}`}
              >
                <p className="act-kicker text-label-medium">
                  {partLabel} {part.number}
                </p>
                <h3
                  className={`mt-1 font-semibold text-ink ${compact ? 'text-title-medium' : 'text-title-large'}`}
                >
                  <Link
                    href={href}
                    className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
                  >
                    {part.title}
                  </Link>
                </h3>
                {!compact && part.tagline && (
                  <p className="mt-2 text-body-medium text-muted">
                    {part.tagline}
                  </p>
                )}
                <p className="mt-auto pt-3 text-label-medium text-muted">
                  <time dateTime={isoDate(part.starts)}>
                    {formatRange(part.starts, part.ends)}
                  </time>
                  <span aria-hidden="true"> · </span>
                  <span>{when}</span>
                </p>
                {!compact && part.places.length > 0 && (
                  <ul
                    className="mt-3 flex flex-wrap gap-1.5"
                    aria-label="Places"
                  >
                    {part.places.map((place) => (
                      <li
                        key={place.name}
                        className="rounded-full border border-line bg-ground px-2.5 py-0.5 text-label-small text-muted"
                      >
                        {place.name}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </li>
          );
        })}
      </ol>
    </Reveal>
  );
}
