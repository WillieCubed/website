'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import Mark from '@/components/brand/Mark';

/**
 * The cube, with the name wiping in beside it once the top bar has left
 * the screen, so the name shows once per screen. The reveal is a trigger,
 * not tied to scroll distance, so it never stops partway on a page that
 * can only scroll a little.
 */
export default function FooterLockup({ name }: { name: string }) {
  const pathname = usePathname();
  const [revealed, setRevealed] = useState(false);

  // The top bar is replaced on every navigation, so the observer is set up
  // again for each page and dropped for pages without one.
  useEffect(() => {
    const header = document.querySelector('header[data-column]');
    if (!header) {
      const frame = requestAnimationFrame(() => setRevealed(false));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) =>
      setRevealed(!entry.isIntersecting)
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <p
      className="site-footer__lockup text-headline-small font-semibold text-ink"
      data-revealed={revealed}
    >
      <Mark className="site-footer__mark" />
      <span className="site-footer__wordmark">{name}</span>
    </p>
  );
}
