import SiteLink from '@/components/link/SiteLink';

import type { Initiative, Part } from '@/lib/initiatives/index';

interface PartNavProps {
  initiative: Initiative;
  part: Part;
}

export default function PartNav({ initiative, part }: PartNavProps) {
  const index = initiative.parts.findIndex((p) => p.number === part.number);
  const previous = initiative.parts[index - 1];
  const next = initiative.parts[index + 1];

  return (
    <nav aria-label={`${initiative.title} navigation`} className="part-nav">
      <div className="part-nav__adjacent">
        {[previous, next].map(
          (destination, direction) =>
            destination != null && (
              <SiteLink
                key={destination.number}
                preview={false}
                href={`${initiative.href}/${destination.slug}`}
                aria-label={`${initiative.partLabel} ${destination.number}: ${destination.title}`}
                rel={direction === 0 ? 'prev' : 'next'}
                className="part-nav__part"
              >
                <span className="part-nav__title">{destination.title}</span>
                <span className="part-nav__position">
                  {direction === 0 && '← '}
                  {initiative.partLabel} {destination.number}
                  {direction === 1 && ' →'}
                </span>
              </SiteLink>
            )
        )}
      </div>
      <SiteLink
        preview={false}
        href={initiative.href}
        className="part-nav__overview site-control px-4 py-2 text-label-large [--control-ink:var(--color-ink)] [--control-border:1px_solid_var(--color-line)]"
      >
        All of {initiative.title}
      </SiteLink>
    </nav>
  );
}
