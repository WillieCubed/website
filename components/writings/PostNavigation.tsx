import SiteLink from '@/components/link/SiteLink';

import type { WritingData } from '@/lib/writings';

interface PostNavigationProps {
  previous: WritingData | null;
  next: WritingData | null;
}

export default function PostNavigation({
  previous,
  next,
}: PostNavigationProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      className="mt-2xl border-t border-outline-variant pt-xl"
      aria-label="Post navigation"
    >
      <div className="flex justify-between gap-lg">
        {previous ? (
          <SiteLink
            href={`/writings/${previous.slug}`}
            rel="prev"
            className="group flex-1 text-left"
          >
            <span className="text-label-medium text-on-surface-variant">
              &larr; Previous
            </span>
            <span className="mt-xs block text-title-medium text-on-surface group-hover:text-primary transition-colors">
              {previous.title}
            </span>
          </SiteLink>
        ) : (
          <div className="flex-1" />
        )}

        {next ? (
          <SiteLink
            href={`/writings/${next.slug}`}
            rel="next"
            className="group flex-1 text-right"
          >
            <span className="text-label-medium text-on-surface-variant">
              Next &rarr;
            </span>
            <span className="mt-xs block text-title-medium text-on-surface group-hover:text-primary transition-colors">
              {next.title}
            </span>
          </SiteLink>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </nav>
  );
}
