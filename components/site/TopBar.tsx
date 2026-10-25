import PaletteTrigger from '@/components/search/palette/PaletteTrigger';

import type { PageColumn } from '@/lib/site/footer/column';
import { site } from '@/lib/site/identity';
import { routedPages } from '@/lib/site/navigation';

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
  reading: 'site-frame site-frame--reading',
  content: 'site-frame site-frame--content',
  media: 'site-frame site-frame--media',
  wide: 'site-frame site-frame--wide',
} as const satisfies Record<PageColumn, string>;

export type Column = keyof typeof COLUMN;

interface TopBarProps {
  crumbs?: Crumb[];
  floating?: boolean;
  /** Which content column the bar should line up with. */
  column?: Column;
  /** Keep the page ending close to the footer after a navigation surface. */
  compactFooter?: boolean;
  /** Pages with a dedicated search field can omit the site search trigger. */
  showSearch?: boolean;
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
  compactFooter = false,
  prefetchHome = true,
  showSearch = true,
}: TopBarProps) {
  return (
    // Each page renders its own bar, so navigation pairs the old and new bars.
    <ViewTransition name="site-top-bar" share="top-bar" default="none">
      <TopBarFrame
        column={column}
        compactFooter={compactFooter}
        floatOnScroll={floating}
        longTrail={crumbs.length >= 2}
        breadcrumbKey={crumbs
          .map(({ href, label }) => `${href}:${label}`)
          .join('|')}
        className={`site-topbar mx-auto flex items-center gap-1 max-[360px]:gap-0 text-label-large text-muted ${COLUMN[column]}`}
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
          {crumbs.length >= 2 && (
            <div className="site-breadcrumbs__crumb site-breadcrumbs__crumb--collapsed flex items-center">
              <span aria-hidden="true">/</span>
              <div className="site-breadcrumb-item">
                <BreadcrumbMenu
                  label="…"
                  title="Pages above this one"
                  href={crumbs[crumbs.length - 2].href}
                  items={crumbs
                    .slice(0, -1)
                    .map(({ label, href }, depth) => ({ label, href, depth }))}
                  showArrow={false}
                />
              </div>
            </div>
          )}
          {crumbs.map((crumb, index) => (
            <div
              key={crumb.href}
              className={`site-breadcrumbs__crumb flex items-center${
                index < crumbs.length - 1
                  ? ' site-breadcrumbs__crumb--middle'
                  : ''
              }`}
              data-depth={index < crumbs.length - 1 ? index : undefined}
            >
              <span aria-hidden="true">/</span>
              <div className="site-breadcrumb-item">
                <BreadcrumbMenu
                  label={crumb.label}
                  href={crumb.href}
                  items={[
                    { label: crumb.label, href: crumb.href },
                    ...((crumb.menuItems?.length ?? 0) > 0
                      ? (crumb.menuItems ?? [])
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
        {showSearch && (
          <div className="site-topbar-search ml-auto flex shrink-0 items-center">
            <PaletteTrigger size="compact" glass={floating} />
          </div>
        )}
      </TopBarFrame>
    </ViewTransition>
  );
}
