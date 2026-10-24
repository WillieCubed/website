import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import type { Initiative, Part } from '@/lib/initiatives/index';

type NavigationPart = Pick<Part, 'number' | 'slug' | 'title'>;
type CurrentPart = Pick<Part, 'number'>;
type NavigationInitiative = Pick<Initiative, 'title' | 'partLabel' | 'href'> & {
  parts: NavigationPart[];
};

interface PartNavProps {
  initiative: NavigationInitiative;
  part: CurrentPart;
}

export default function PartNav({ initiative, part }: PartNavProps) {
  const index = initiative.parts.findIndex((p) => p.number === part.number);
  const previous = initiative.parts[index - 1];
  const next = initiative.parts[index + 1];

  return (
    <nav aria-label={`${initiative.title} navigation`} className="part-nav">
      {[previous, next].map(
        (destination, direction) =>
          destination != null && (
            <SiteLink
              key={destination.number}
              preview={false}
              href={`${initiative.href}/${destination.slug}`}
              rel={direction === 0 ? 'prev' : 'next'}
              className="part-nav__part"
            >
              <Icon
                name={direction === 0 ? 'arrow-left' : 'arrow-right'}
                size={20}
              />
              <span>
                {initiative.partLabel} {destination.number}: {destination.title}
              </span>
            </SiteLink>
          )
      )}
    </nav>
  );
}
