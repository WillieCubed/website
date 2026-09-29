import SiteLink from '@/components/link/SiteLink';
import PaletteTrigger from '@/components/palette/PaletteTrigger';

import type { PageColumn } from '@/lib/footer/column';
import { routedPages, site } from '@/lib/site';

import BreadcrumbMenu, { type BreadcrumbMenuItem } from './BreadcrumbMenu';
import TopBarFrame from './TopBarFrame';
import './site.css';
import { ViewTransition } from './view-transition';

interface Crumb {
  label: string;
  href: string;
  menuItems?: BreadcrumbMenuItem[];
}

const SITE_DESTINATIONS: BreadcrumbMenuItem[] = [
  { label: 'Home', href: '/' },
  ...routedPages.map(({ label, path }) => ({ label, href: path })),
];

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
  floating?: boolean;
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
  floating = false,
  column = 'wide',
  prefetchHome = true,
}: TopBarProps) {
  return (
    // Each page renders its own bar, so navigation pairs the old and new bars.
    <ViewTransition name="site-top-bar" share="top-bar" default="none">
      <TopBarFrame
        column={column}
        breadcrumbKey={crumbs
          .map(({ href, label }) => `${href}:${label}`)
          .join('|')}
        className={`mx-auto flex items-center gap-1 max-[360px]:gap-0 py-4 text-label-large text-muted ${COLUMN[column]}`}
      >
        <nav
          className={`site-breadcrumbs${floating ? ' site-glass' : ''}`}
          aria-label="Breadcrumb"
        >
          <div className="site-breadcrumb-item site-breadcrumb-item--home">
            <BreadcrumbMenu
              label={site.name}
              href="/"
              items={SITE_DESTINATIONS}
              showArrow={crumbs.length === 0}
              home
              prefetchHome={prefetchHome}
            />
          </div>
          {crumbs.map((crumb, index) => (
            <div
              key={crumb.href}
              className="site-breadcrumbs__crumb flex items-center"
            >
              <span aria-hidden="true">/</span>
              <div className="site-breadcrumb-item">
                <BreadcrumbMenu
                  label={crumb.label}
                  href={crumb.href}
                  items={[
                    { label: crumb.label, href: crumb.href },
                    ...(crumb.menuItems?.length
                      ? crumb.menuItems
                      : routedPages.some((page) => page.path === crumb.href)
                        ? routedPages.map(({ label, path }) => ({
                            label,
                            href: path,
                          }))
                        : []
                    ).filter((item) => item.href !== crumb.href),
                  ]}
                  showArrow={index === crumbs.length - 1}
                />
              </div>
            </div>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center">
          <PaletteTrigger size="compact" glass={floating} />
          <noscript>
            <SiteLink
              preview={false}
              href="/search"
              className="site-breadcrumb"
            >
              Search
            </SiteLink>
          </noscript>
        </div>
      </TopBarFrame>
    </ViewTransition>
  );
}
