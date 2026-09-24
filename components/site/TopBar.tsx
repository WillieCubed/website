import type { ReactNode } from 'react';

import SiteLink from '@/components/link/SiteLink';
import PaletteTrigger from '@/components/palette/PaletteTrigger';

import type { PageColumn } from '@/lib/footer/column';
import { site } from '@/lib/site';

import TopBarFrame from './TopBarFrame';
import './site.css';

interface Crumb {
  label: string;
  href: string;
  control?: ReactNode;
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
} as const satisfies Record<PageColumn, string>;

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
 * chrome on immersive pages so the content keeps the room. It also tells
 * the footer which column to line up with (TopBarFrame).
 */
export default function TopBar({
  crumbs = [],
  column = 'wide',
  prefetchHome = true,
}: TopBarProps) {
  return (
    <TopBarFrame
      column={column}
      className={`mx-auto flex items-center gap-1 py-4 text-label-large text-muted ${COLUMN[column]}`}
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
        <div key={crumb.href} className="flex items-center gap-1">
          <span aria-hidden="true">/</span>
          {crumb.control ?? (
            <SiteLink
              preview={false}
              href={crumb.href}
              className="site-breadcrumb"
            >
              {crumb.label}
            </SiteLink>
          )}
        </div>
      ))}
      <div className="ml-auto flex items-center">
        <PaletteTrigger size="compact" />
        <noscript>
          <SiteLink preview={false} href="/search" className="site-breadcrumb">
            Search
          </SiteLink>
        </noscript>
      </div>
    </TopBarFrame>
  );
}
