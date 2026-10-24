import Image from 'next/image';

import SiteLink from '@/components/link/SiteLink';

import { formatRange, isoDate } from '@/lib/initiatives/dates';
import type { Initiative } from '@/lib/initiatives/index';

import Reveal from './Reveal';

interface PlaybillProps {
  initiative: Initiative;
  /** `compact` fits inside a homepage tile; `full` is the initiative page. */
  variant?: 'full' | 'compact';
  showCovers?: boolean;
}

/**
 * The acts of a campaign, in order. Every act is fully rendered on the
 * server; the reveal is only an entrance, never a gate, so nothing here is
 * hidden behind a hover or a scroll position.
 */
export default function Playbill({
  initiative,
  variant = 'full',
  showCovers = true,
}: PlaybillProps) {
  const { parts, partLabel } = initiative;
  if (parts.length === 0) return null;
  const compact = variant === 'compact';
  const showArtwork = !compact && showCovers;

  return (
    <Reveal>
      <ol
        className={
          compact
            ? 'playbill playbill--compact grid gap-2'
            : 'playbill playbill--full grid gap-4 medium:grid-cols-2 large:grid-cols-4'
        }
        aria-label={`${initiative.title} acts`}
      >
        {parts.map((part) => {
          const href = `${initiative.href}/${part.slug}`;
          return (
            <li
              key={part.slug}
              className="act"
              aria-current={part.status === 'active' ? 'step' : undefined}
            >
              <article
                className={`act-card relative flex h-full flex-col rounded-2xl ${compact ? 'p-3' : 'p-5'}`}
              >
                {showArtwork && part.cover && (
                  <figure className="act-art relative m-0 aspect-[3/2] overflow-hidden rounded-xl">
                    <Image
                      src={part.cover.src}
                      alt={part.cover.alt}
                      fill
                      sizes="(min-width: 840px) 50vw, 100vw"
                      className="object-cover"
                      unoptimized={part.cover.src.endsWith('.svg')}
                    />
                  </figure>
                )}
                <div className="act-copy flex min-w-0 flex-1 flex-col">
                  <h3
                    className={`mt-1 font-semibold text-ink ${compact ? 'text-title-medium' : 'text-title-large'}`}
                  >
                    <SiteLink
                      preview={false}
                      href={href}
                      className="after:absolute after:inset-0 after:rounded-2xl focus-visible:rounded-2xl"
                    >
                      {part.title}
                    </SiteLink>
                  </h3>
                  {!compact && part.tagline && (
                    <p className="mt-2 text-body-medium text-muted">
                      {part.tagline}
                    </p>
                  )}
                  <p className="mt-auto pt-3 text-body-small text-muted">
                    {partLabel} {part.number} ·{' '}
                    <time dateTime={isoDate(part.starts)}>
                      {formatRange(part.starts, part.ends)}
                    </time>
                  </p>
                  {!compact && part.places.length > 0 && (
                    <ul
                      className="mt-3 flex flex-wrap gap-inline"
                      aria-label="Places"
                    >
                      {part.places.map((place) => (
                        <li
                          key={place.name}
                          className="rounded-full border border-line bg-ground px-3 py-1 text-label-small text-muted"
                        >
                          {place.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </Reveal>
  );
}
