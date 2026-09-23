import SiteLink from '@/components/link/SiteLink';
import { PagefindTrigger } from '@/components/search/pagefind';

import { site } from '@/lib/site';

interface Crumb {
  label: string;
  href: string;
}

/**
 * The column widths pages use. The bar takes the same one as the content
 * below it so the breadcrumb lines up with the text instead of floating in
 * a wider gutter.
 */
export const COLUMN = {
  reading: 'max-w-breakpoint-md px-lg desktop:px-0',
  content: 'max-w-[840px] px-5',
  wide: 'max-w-[1200px] px-5',
} as const;

export type Column = keyof typeof COLUMN;

interface TopBarProps {
  crumbs?: Crumb[];
  /** Which content column the bar should line up with. */
  column?: Column;
  /**
   * Prefetch the homepage from the name link. The prefetch carries the
   * homepage's image preloads, so a page that never shows those images, such
   * as the 404, turns it off rather than leave them unused.
   */
  prefetchHome?: boolean;
}

/**
 * A slim bar with the way home and where the visitor is. It is the only
 * chrome on immersive pages so the content keeps the room.
 */
export default function TopBar({
  crumbs = [],
  column = 'wide',
  prefetchHome = true,
}: TopBarProps) {
  return (
    <header
      data-column={column}
      className={`mx-auto flex items-center gap-3 py-4 text-label-large text-muted ${COLUMN[column]}`}
    >
      <SiteLink
        preview={false}
        href="/"
        prefetch={prefetchHome ? undefined : false}
        rel="author"
        className="font-semibold text-ink transition-colors hover:text-accent"
      >
        {site.name}
      </SiteLink>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-3">
          <span aria-hidden="true">/</span>
          <SiteLink
            preview={false}
            href={crumb.href}
            className="transition-colors hover:text-ink"
          >
            {crumb.label}
          </SiteLink>
        </span>
      ))}
      <div className="ml-auto flex items-center">
        <PagefindTrigger compact hideShortcut />
        <noscript>
          <SiteLink
            preview={false}
            href="/search"
            className="transition-colors hover:text-ink"
          >
            Search
          </SiteLink>
        </noscript>
      </div>
    </header>
  );
}
