import type { PropsWithChildren, ReactNode } from 'react';

import { splitBrews } from '@/lib/writings/remark-brews';

/**
 * "Coffee" or "tea" in running copy, leading to the teapot. Quiet on
 * purpose: it keeps the prose's colour and weight and shows only a faint
 * dotted underline until pointed at.
 */
export default function BrewLink({
  href,
  children,
}: PropsWithChildren<{ href: string }>) {
  return (
    // A plain anchor, not SiteLink: /coffee and /tea are route handlers,
    // not pages the router can render, so they take a full navigation. The
    // colours are important so a prose link rule (.initiative-prose a) does
    // not paint the word in the accent before it is pointed at.
    <a
      href={href}
      className="text-inherit! [font-weight:inherit] underline decoration-current/30 decoration-dotted decoration-1 underline-offset-[0.2em] transition-colors hover:text-accent! hover:decoration-accent focus-visible:text-accent!"
    >
      {children}
    </a>
  );
}

/**
 * Links the brew words in a hand-written string, for JSX copy that never
 * passes through MDX. Copy without them comes back unchanged.
 */
export function withBrewLinks(text: string): ReactNode {
  const segments = splitBrews(text);
  if (!segments) return text;
  return segments.map((segment, i) =>
    typeof segment === 'string' ? (
      segment
    ) : (
      <BrewLink key={i} href={segment.href}>
        {segment.word}
      </BrewLink>
    )
  );
}
