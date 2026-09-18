import SiteLink from '@/components/link/SiteLink';

import { site } from '@/lib/site';

interface Crumb {
  label: string;
  href: string;
}

/**
 * A slim bar with the way home and where the visitor is. It is the only
 * chrome on immersive pages so the content keeps the room.
 */
export default function TopBar({ crumbs = [] }: { crumbs?: Crumb[] }) {
  return (
    <header className="mx-auto flex max-w-[1200px] items-center gap-3 px-5 py-4 text-label-large text-muted">
      <SiteLink
        preview={false}
        href="/"
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
    </header>
  );
}
