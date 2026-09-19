'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { dockVars, footerProgress } from '@/lib/footer/dock';
import { createNameReveal, waveProgress } from '@/lib/footer/name-reveal';

const COMPACT = '(max-width: 839px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * The page that is on screen. A soft navigation leaves the page before it
 * in the document, hidden, so the homepage's rail can still be found on
 * another page; only the one being shown takes up space.
 */
function onScreen(selector: string): boolean {
  return [...document.querySelectorAll(selector)].some(
    (element) => element.getClientRects().length > 0
  );
}

/**
 * On the homepage, opens the footer out of its contact row as the page ends.
 * It marks the footer for site.css to draw, then only writes numbers: how
 * far open the footer is and the values drawn from that (lib/footer/dock.ts),
 * plus the name's letter wave. On every other page it does nothing, and the
 * footer is the plain block it always was.
 */
export default function FooterDock() {
  const pathname = usePathname();

  // Set up again on every navigation, since only the homepage has a rail
  // for the footer to grow out of.
  useEffect(() => {
    const footer = document.querySelector<HTMLElement>('footer.site-footer');
    if (!footer || !onScreen('.home')) return;
    footer.dataset.dock = '';

    const contact = footer.querySelector<HTMLElement>('[data-footer-contact]');
    const anchor = document.querySelector<HTMLElement>('[data-footer-anchor]');
    const name = footer.querySelector<HTMLElement>('[data-footer-name]');
    const compact = window.matchMedia(COMPACT);
    const reduce = window.matchMedia(REDUCE);
    const reveal =
      name?.firstChild instanceof Text
        ? createNameReveal(name.firstChild, {
            reduceMotion: () => reduce.matches,
          })
        : null;

    let p = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const footerHeight = footer.offsetHeight;
      p = footerProgress({
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        footerHeight,
      });
      for (const [key, value] of Object.entries(dockVars(p, compact.matches))) {
        footer.style.setProperty(`--${key}`, value.toFixed(4));
      }
      // The collapsed row's surface wraps the contact links as they are
      // drawn now, which widen as their icons open.
      if (contact) {
        footer.style.setProperty('--pill-w', `${contact.offsetWidth}px`);
      }
      const headline = anchor?.getBoundingClientRect() ?? null;
      reveal?.set(
        waveProgress({ p, compact: compact.matches, headline, footerHeight })
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // Tabbing into a part of the footer that is still closed goes to the end
    // of the page, where it is open, rather than to something clipped away.
    // The contact links are on screen from the start on a wide window.
    const onFocus = (event: FocusEvent) => {
      if (p >= 1) return;
      const target = event.target as Node;
      if (!compact.matches && contact?.contains(target)) return;
      window.scrollTo({ top: document.documentElement.scrollHeight });
    };

    // The page grows as images load and the tagline streams in, which moves
    // where the footer's stretch of scroll starts.
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    resize.observe(footer);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    compact.addEventListener('change', schedule);
    footer.addEventListener('focusin', onFocus);
    update();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      compact.removeEventListener('change', schedule);
      footer.removeEventListener('focusin', onFocus);
      reveal?.destroy();
      for (const key of [...Object.keys(dockVars(0, false)), 'pill-w']) {
        footer.style.removeProperty(`--${key}`);
      }
      delete footer.dataset.dock;
    };
  }, [pathname]);

  return null;
}
