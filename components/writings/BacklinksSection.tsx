import SiteLink from '@/components/link/SiteLink';

import { formatDate } from '@/lib/site';
import type { Backlink } from '@/lib/writings/backlinks';

interface BacklinksSectionProps {
  backlinks: Backlink[];
}

/**
 * Other writings here that link to this one. The hover card carries each
 * one's summary, so the list itself is just title and date.
 */
export default function BacklinksSection({ backlinks }: BacklinksSectionProps) {
  if (backlinks.length === 0) {
    return null;
  }

  return (
    <section aria-label="Linked from" className="space-y-3">
      <h2 className="text-label-medium text-muted">Linked from</h2>
      <ul className="space-y-2">
        {backlinks.map((backlink) => (
          <li
            key={backlink.slug}
            className="flex flex-wrap items-baseline gap-x-3 text-body-medium"
          >
            <SiteLink
              href={`/writings/${backlink.slug}`}
              className="link-animated font-medium text-ink"
            >
              {backlink.title}
            </SiteLink>
            <span className="text-label-medium text-muted">
              {formatDate(backlink.published, 'short')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
