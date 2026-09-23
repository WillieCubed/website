'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import Mark from '@/components/brand/Mark';

import {
  getTopBar,
  getTopBarOnServer,
  subscribeTopBar,
} from '@/lib/footer/column';

/**
 * The cube, with the name beside it. The name shows once per screen: on
 * most pages it wipes in once the top bar has left the screen, a trigger
 * rather than a scroll distance, so it never stops partway on a page that
 * can only scroll a little. On the homepage the footer's letter wave
 * brings it in instead (lib/footer/name-reveal.ts), and footer-dock.css
 * turns the wipe off there.
 */
export default function FooterLockup({ name }: { name: string }) {
  const header = useSyncExternalStore(
    subscribeTopBar,
    getTopBar,
    getTopBarOnServer
  );
  const [revealed, setRevealed] = useState(false);

  // Each page's top bar registers itself while it is on screen, so the
  // observer follows it from page to page and is dropped for pages without
  // one.
  useEffect(() => {
    if (!header) {
      const frame = requestAnimationFrame(() => setRevealed(false));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) =>
      setRevealed(!entry.isIntersecting)
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [header]);

  return (
    <p
      className="site-footer__lockup text-headline-small font-semibold text-ink"
      data-revealed={revealed}
    >
      <Mark className="site-footer__mark" />
      <span className="site-footer__wordmark" data-footer-name>
        {name}
      </span>
    </p>
  );
}
