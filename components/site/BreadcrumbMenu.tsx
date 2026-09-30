'use client';

import { usePathname } from 'next/navigation';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import Popover from './Popover';

export interface BreadcrumbMenuItem {
  label: string;
  href: string;
}

export default function BreadcrumbMenu({
  label,
  href,
  items,
  showArrow,
  home = false,
  prefetchHome = true,
}: {
  label: string;
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
        {label}
      </SiteLink>
    );
  }

  return (
    <Popover
      label={`Open menu for ${label}`}
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
        aria-label={`${label} destinations`}
      >
        {items.map((item) => (
          <SiteLink
            key={item.href}
            href={item.href}
            preview={false}
            className="site-breadcrumb-menu__link"
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
