'use client';

import { usePathname } from 'next/navigation';

import Mark from '@/components/brand/Mark';
import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import Popover from './Popover';

export interface BreadcrumbMenuItem {
  label: string;
  href: string;
  /** The crumb this item stands in for inside the ellipsis crumb's menu. */
  depth?: number;
}

export default function BreadcrumbMenu({
  label,
  title,
  href,
  items,
  showArrow,
  home = false,
  prefetchHome = true,
}: {
  label: string;
  /** Names the menu when the visible label cannot, such as an ellipsis. */
  title?: string;
  href: string;
  items: BreadcrumbMenuItem[];
  showArrow: boolean;
  home?: boolean;
  prefetchHome?: boolean;
}) {
  const pathname = usePathname();

  if (home) {
    return (
      <SiteLink
        href={href}
        preview={false}
        prefetch={prefetchHome ? undefined : false}
        rel="author"
        aria-current={href === pathname ? 'page' : undefined}
        className="site-breadcrumb-name font-semibold text-ink"
      >
        <Mark className="site-breadcrumb-name__mark" />
        <span className="site-breadcrumb-name__label">{label}</span>
      </SiteLink>
    );
  }

  return (
    <Popover
      label={title ?? `Open menu for ${label}`}
      current={href === pathname}
      placement="breadcrumb"
      trigger={
        <>
          <span className="site-breadcrumb-menu__label">{label}</span>
          {showArrow && (
            <span className="site-breadcrumb-menu__icon" aria-hidden="true">
              <Icon name="chevron-down" size={12} />
            </span>
          )}
        </>
      }
      triggerClassName="site-breadcrumb site-breadcrumb-menu-trigger"
      panelClassName="site-breadcrumb-menu"
    >
      <nav
        className="site-breadcrumb-menu__items"
        aria-label={title ?? `${label} destinations`}
      >
        {items.map((item) => (
          <SiteLink
            key={item.href}
            href={item.href}
            preview={false}
            className="site-breadcrumb-menu__link"
            data-depth={item.depth}
            aria-current={item.href === pathname ? 'page' : undefined}
            onClick={() => {
              if (item.href.startsWith('#')) {
                document
                  .getElementById(item.href.slice(1))
                  ?.focus({ preventScroll: true });
              }
            }}
          >
            {item.label}
          </SiteLink>
        ))}
      </nav>
    </Popover>
  );
}
