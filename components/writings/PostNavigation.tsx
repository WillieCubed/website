import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import type { WritingData } from '@/lib/writings';

interface PostNavigationProps {
  /** The post published before this one. */
  previous: WritingData | null;
  /** The post published after this one. */
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
      className="mt-12 grid gap-3 medium:grid-cols-2"
      aria-label="Nearby posts"
    >
      {previous ? (
        <SiteLink
          preview={false}
          href={`/writings/${previous.slug}`}
          rel="prev"
          className="group flex flex-col gap-1 rounded-2xl bg-card px-5 py-4 text-ink transition-colors hover:bg-tray"
        >
          <span className="flex items-center gap-1 text-label-medium text-muted">
            <Icon name="arrow-left" size={14} />
            Older
          </span>
          <span className="text-title-medium font-semibold group-hover:text-accent">
            {previous.title}
          </span>
        </SiteLink>
      ) : (
        <span />
      )}
      {next ? (
        <SiteLink
          preview={false}
          href={`/writings/${next.slug}`}
          rel="next"
          className="group flex flex-col items-end gap-1 rounded-2xl bg-card px-5 py-4 text-right text-ink transition-colors hover:bg-tray"
        >
          <span className="flex items-center gap-1 text-label-medium text-muted">
            Newer
            <Icon name="arrow-right" size={14} />
          </span>
          <span className="text-title-medium font-semibold group-hover:text-accent">
            {next.title}
          </span>
        </SiteLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
